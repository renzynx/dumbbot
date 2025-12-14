import {
  LavalinkNode,
  type Track,
  type LoadResult,
  type Filters,
} from "@discordbot/lavalink";
import { Collection, MessageFlags, type VoiceChannel, type StageChannel } from "discord.js";
import type { BotClient } from "@/core/Client";
import { Queue } from "./Queue.js";
import { Logger } from "@/utils/Logger";
import { formatDuration } from "@/utils/format";
import { GuildSettingsManager } from "./GuildSettings.js";
import { NowPlayingManager } from "./NowPlayingManager.js";
import { VoiceManager } from "./VoiceManager.js";
import type { MusicManagerOptions, QueueTrack, GuildPlayer, SearchPlatform } from "@/types/music";
import { LoopMode } from "@/types/music";

/**
 * Music manager - coordinates Lavalink nodes, queues, and playback
 */
export class MusicManager {
  public readonly client: BotClient;
  public readonly nodes = new Collection<string, LavalinkNode>();
  public readonly queues = new Collection<string, Queue>();
  public readonly players = new Collection<string, GuildPlayer>();
  public readonly settings = new GuildSettingsManager();
  public readonly voice: VoiceManager;
  public readonly nowPlaying: NowPlayingManager;
  
  private readonly logger = new Logger("Music");
  private readonly options: MusicManagerOptions;

  constructor(client: BotClient, options: MusicManagerOptions) {
    this.client = client;
    this.options = options;
    this.voice = new VoiceManager(client, () => this.getIdealNode());
    this.nowPlaying = new NowPlayingManager(client);
    this.setupButtonHandler();
  }

  // Expose voiceConnections for backwards compatibility
  get voiceConnections() {
    return {
      get: (guildId: string) => this.voice.get(guildId),
      has: (guildId: string) => this.voice.has(guildId),
      delete: (guildId: string) => this.voice.delete(guildId),
    };
  }

  /**
   * Initialize all Lavalink nodes
   */
  async initialize(): Promise<void> {
    // Preload guild settings from database
    const settingsCount = this.settings.preload();
    this.logger.info(`Loaded ${settingsCount} guild settings from database`);

    for (const nodeOptions of this.options.nodes) {
      const node = new LavalinkNode({
        ...nodeOptions,
        userId: this.client.user!.id,
      });

      this.setupNodeEvents(node, nodeOptions.host);
      this.nodes.set(nodeOptions.host, node);

      try {
        await node.connect();
        this.logger.success(`Connected to Lavalink node: ${nodeOptions.host}`);
      } catch (error) {
        this.logger.error(`Failed to connect to node ${nodeOptions.host}:`, error);
      }
    }
  }

  /**
   * Setup event handlers for a node
   */
  private setupNodeEvents(node: LavalinkNode, name: string): void {
    node.on("connected", (sessionId, resumed) => {
      this.logger.info(`Node ${name} connected (session: ${sessionId}, resumed: ${resumed})`);
    });

    node.on("disconnected", (code, reason) => {
      this.logger.warn(`Node ${name} disconnected: ${code} - ${reason}`);
    });

    node.on("error", (error) => {
      this.logger.error(`Node ${name} error:`, error);
    });

    node.on("trackStart", (event) => {
      const queue = this.queues.get(event.guildId);
      if (queue) {
        queue.clearSkipVotes();
        this.syncPlayerState(event.guildId);
        
        if (queue.textChannelId) {
          const player = this.getPlayer(event.guildId);
          this.nowPlaying.sendNowPlaying(queue, player.paused);
        }
        this.broadcastPlayerUpdate(event.guildId);
      }
    });

    node.on("trackEnd", async (event) => {
      const queue = this.queues.get(event.guildId);
      if (!queue) return;

      if (queue.current && event.reason === "finished") {
        queue.addToHistory(queue.current);
      }

      if (event.reason === "replaced" || event.reason === "stopped") {
        this.syncPlayerState(event.guildId);
        return;
      }

      const next = queue.next();
      if (next) {
        await this.playTrack(event.guildId, next);
      } else {
        this.syncPlayerState(event.guildId);
        this.broadcastPlayerUpdate(event.guildId);
        
        const guildSettings = this.settings.get(event.guildId);
        
        if (guildSettings.autoplayEnabled && queue.previous) {
          await this.tryAutoplay(event.guildId, queue.previous);
        } else if (!guildSettings.twentyFourSevenMode) {
          setTimeout(() => {
            const currentQueue = this.queues.get(event.guildId);
            if (currentQueue && !currentQueue.current && currentQueue.size === 0) {
              this.disconnect(event.guildId);
            }
          }, 30000);
        }
      }
    });

    node.on("trackException", (event) => {
      this.logger.error(`Track exception in ${event.guildId}:`, event.exception);
      const queue = this.queues.get(event.guildId);
      if (queue) {
        const next = queue.next();
        if (next) this.playTrack(event.guildId, next);
      }
    });

    node.on("trackStuck", async (event) => {
      this.logger.warn(`Track stuck in ${event.guildId}, skipping...`);
      const queue = this.queues.get(event.guildId);
      if (queue) {
        const next = queue.next();
        if (next) await this.playTrack(event.guildId, next);
      }
    });

    node.on("websocketClosed", (event) => {
      this.logger.warn(`WebSocket closed for ${event.guildId}: ${event.code} - ${event.reason}`);
      if (event.byRemote) this.cleanup(event.guildId);
    });

    node.on("playerUpdate", (guildId, state) => {
      const player = this.players.get(guildId);
      if (player) {
        player.position = state.position;
        player.positionTimestamp = state.time;
      }
    });
  }

  /**
   * Setup button interaction handler for music controls
   */
  private setupButtonHandler(): void {
    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isButton()) return;
      if (!interaction.customId.startsWith("music_")) return;

      const guildId = interaction.guildId;
      if (!guildId) return;

      const queue = this.queues.get(guildId);
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      
      if (!member?.voice.channel) {
        await interaction.reply({
          content: "You need to be in a voice channel to use music controls!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const botVoiceChannel = this.voice.get(guildId)?.channelId;
      if (botVoiceChannel && member.voice.channel.id !== botVoiceChannel) {
        await interaction.reply({
          content: "You need to be in the same voice channel as me!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      try {
        await this.handleMusicButton(interaction, guildId, queue);
      } catch (error) {
        this.logger.error("Button interaction error:", error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "An error occurred while processing your request.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    });
  }

  /**
   * Handle music control button interactions
   */
  private async handleMusicButton(
    interaction: import("discord.js").ButtonInteraction,
    guildId: string,
    queue: Queue | undefined
  ): Promise<void> {
    const action = interaction.customId.replace("music_", "");

    switch (action) {
      case "pause_resume": {
        const node = this.getNodeForGuild(guildId);
        const player = node?.getPlayer(guildId);
        
        if (player?.paused) {
          await this.resume(guildId);
          await interaction.reply({ content: "▶ Resumed playback", flags: MessageFlags.Ephemeral });
        } else {
          await this.pause(guildId);
          await interaction.reply({ content: "⏸ Paused playback", flags: MessageFlags.Ephemeral });
        }
        if (queue) await this.nowPlaying.updateMessage(queue, this.getPlayer(guildId).paused);
        break;
      }

      case "skip": {
        if (!queue?.current) {
          await interaction.reply({ content: "Nothing is playing!", flags: MessageFlags.Ephemeral });
          return;
        }
        const skipped = await this.skip(guildId);
        await interaction.reply({
          content: skipped ? `⏭ Skipped **${skipped.track.info.title}**` : "⏭ Skipped",
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "stop": {
        await this.stop(guildId);
        await this.disconnect(guildId);
        await interaction.reply({ content: "⏹ Stopped playback and disconnected", flags: MessageFlags.Ephemeral });
        await this.nowPlaying.deleteMessage(guildId);
        break;
      }

      case "shuffle": {
        if (!queue || queue.size === 0) {
          await interaction.reply({ content: "The queue is empty!", flags: MessageFlags.Ephemeral });
          return;
        }
        this.shuffle(guildId);
        await interaction.reply({ content: "🔀 Shuffled the queue", flags: MessageFlags.Ephemeral });
        break;
      }

      case "loop": {
        if (!queue) {
          await interaction.reply({ content: "Nothing is playing!", flags: MessageFlags.Ephemeral });
          return;
        }
        
        const modes: LoopMode[] = [LoopMode.None, LoopMode.Track, LoopMode.Queue];
        const currentIndex = modes.indexOf(queue.loopMode);
        const nextMode = modes[(currentIndex + 1) % modes.length]!;
        
        this.setLoopMode(guildId, nextMode);
        
        const modeNames = {
          [LoopMode.None]: "🔁 Loop disabled",
          [LoopMode.Track]: "🔂 Looping current track",
          [LoopMode.Queue]: "🔁 Looping queue",
        };
        
        await interaction.reply({ content: modeNames[nextMode], flags: MessageFlags.Ephemeral });
        await this.nowPlaying.updateMessage(queue, this.getPlayer(guildId).paused);
        break;
      }

      case "queue": {
        if (!queue || (queue.size === 0 && !queue.current)) {
          await interaction.reply({ content: "The queue is empty!", flags: MessageFlags.Ephemeral });
          return;
        }
        await this.nowPlaying.showQueuePage(interaction, queue, 0);
        break;
      }

      default: {
        if (action.startsWith("queue_page_")) {
          const page = parseInt(action.replace("queue_page_", ""), 10);
          if (!isNaN(page) && queue) {
            await this.nowPlaying.handleQueuePagination(interaction, queue, page);
          }
          return;
        }
        await interaction.reply({ content: "Unknown action", flags: MessageFlags.Ephemeral });
      }
    }
  }

  /**
   * Get the best available node
   */
  getIdealNode(): LavalinkNode | null {
    let bestNode: LavalinkNode | null = null;
    let bestPenalty = Infinity;

    for (const node of this.nodes.values()) {
      if (!node.connected) continue;
      const stats = node.getStats();
      if (!stats) {
        bestNode = node;
        continue;
      }
      const penalty = stats.cpu.systemLoad + (stats.players * 5);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestNode = node;
      }
    }
    return bestNode;
  }

  /**
   * Get the node handling a guild
   */
  private getNodeForGuild(guildId: string): LavalinkNode | null {
    return this.getIdealNode();
  }

  /**
   * Get or create a queue for a guild
   */
  getQueue(guildId: string): Queue {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = new Queue(guildId);
      queue.volume = this.options.defaultVolume ?? 100;
      this.queues.set(guildId, queue);
    }
    return queue;
  }

  /**
   * Get or create a cached player for a guild
   */
  getPlayer(guildId: string): GuildPlayer {
    let player = this.players.get(guildId);
    if (!player) {
      const queue = this.getQueue(guildId);
      player = {
        guildId,
        playing: false,
        paused: false,
        position: 0,
        volume: queue.volume,
        loopMode: queue.loopMode,
        current: null,
        queue: [],
        positionTimestamp: Date.now(),
      };
      this.players.set(guildId, player);
    }
    return player;
  }

  /**
   * Sync cached player state from queue and Lavalink
   */
  syncPlayerState(guildId: string): GuildPlayer {
    const player = this.getPlayer(guildId);
    const queue = this.queues.get(guildId);
    const node = this.getIdealNode();
    const lavalinkPlayer = node?.getPlayer(guildId);

    player.current = queue?.current ?? null;
    player.queue = queue?.tracks ?? [];
    player.volume = queue?.volume ?? this.options.defaultVolume ?? 100;
    player.loopMode = queue?.loopMode ?? LoopMode.None;
    player.playing = !!queue?.current;
    player.paused = lavalinkPlayer?.paused ?? false;
    player.position = lavalinkPlayer?.state.position ?? 0;
    player.positionTimestamp = Date.now();

    return player;
  }

  /**
   * Connect to a voice channel
   */
  async connect(guildId: string, channelId: string): Promise<void> {
    await this.voice.connect(guildId, channelId);
    const queue = this.getQueue(guildId);
    queue.voiceChannelId = channelId;
  }

  /**
   * Disconnect from voice
   */
  async disconnect(guildId: string): Promise<void> {
    await this.voice.disconnect(guildId);
    this.cleanup(guildId);
  }

  /**
   * Search for tracks
   */
  async search(query: string, platform?: SearchPlatform): Promise<LoadResult> {
    const node = this.getIdealNode();
    if (!node) throw new Error("No available Lavalink nodes");

    if (query.startsWith("http://") || query.startsWith("https://")) {
      return node.loadTracks(query);
    }

    const searchPlatform = platform ?? this.options.defaultSearchPlatform ?? "youtube";
    switch (searchPlatform) {
      case "youtubemusic": return node.searchYouTubeMusic(query);
      case "soundcloud": return node.searchSoundCloud(query);
      case "spotify": return node.searchSpotify(query);
      case "deezer": return node.searchDeezer(query);
      case "applemusic": return node.searchAppleMusic(query);
      default: return node.searchYouTube(query);
    }
  }

  /**
   * Play a track
   */
  async playTrack(guildId: string, queueTrack: QueueTrack): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (!node) throw new Error("No node available for this guild");

    const queue = this.getQueue(guildId);
    queue.current = queueTrack;

    await node.play(guildId, queueTrack.track, { volume: queue.volume });
  }

  /**
   * Play or queue tracks
   */
  async play(
    guildId: string,
    tracks: Track | Track[],
    requester: string,
    requesterId: string
  ): Promise<{ position: number; tracks: Track[] }> {
    const queue = this.getQueue(guildId);
    const trackArray = Array.isArray(tracks) ? tracks : [tracks];
    queue.addMany(trackArray, requester, requesterId);

    if (!queue.current) {
      const next = queue.next();
      if (next) await this.playTrack(guildId, next);
    }

    return { position: queue.size, tracks: trackArray };
  }

  /**
   * Skip the current track
   */
  async skip(guildId: string): Promise<QueueTrack | null> {
    const queue = this.queues.get(guildId);
    if (!queue) return null;

    const skipped = queue.current;
    if (skipped) queue.addToHistory(skipped);
    
    const next = queue.next();
    if (next) await this.playTrack(guildId, next);
    else await this.stop(guildId);

    return skipped;
  }

  /**
   * Try to autoplay a similar track
   */
  async tryAutoplay(guildId: string, lastTrack: QueueTrack): Promise<boolean> {
    try {
      const query = `${lastTrack.track.info.author} ${lastTrack.track.info.title.split(/[(\-\[\|]/)[0]?.trim() || lastTrack.track.info.title}`;
      const result = await this.search(query);
      
      if (result.loadType === "search" && result.data.length > 0) {
        const queue = this.getQueue(guildId);
        const recentHistory = queue.getHistory(10);
        const recentUris = new Set(recentHistory.map(h => h.track.info.uri));
        if (lastTrack.track.info.uri) recentUris.add(lastTrack.track.info.uri);
        
        const newTrack = result.data.find(t => !recentUris.has(t.info.uri));
        if (newTrack) {
          queue.add(newTrack, "Autoplay", "autoplay");
          const next = queue.next();
          if (next) {
            await this.playTrack(guildId, next);
            return true;
          }
        }
      }
    } catch (error) {
      this.logger.error(`Autoplay failed for ${guildId}:`, error);
    }
    return false;
  }

  /**
   * Stop playback
   */
  async stop(guildId: string): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (node) await node.stop(guildId);

    const queue = this.queues.get(guildId);
    if (queue) {
      queue.current = null;
      queue.clear();
    }

    const player = this.players.get(guildId);
    if (player) {
      player.playing = false;
      player.paused = false;
      player.current = null;
      player.queue = [];
      player.position = 0;
    }
  }

  /**
   * Pause playback
   */
  async pause(guildId: string): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (node) await node.pause(guildId);
    const player = this.players.get(guildId);
    if (player) player.paused = true;
  }

  /**
   * Resume playback
   */
  async resume(guildId: string): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (node) await node.resume(guildId);
    const player = this.players.get(guildId);
    if (player) {
      player.paused = false;
      player.positionTimestamp = Date.now();
    }
  }

  /**
   * Seek to a position
   */
  async seek(guildId: string, position: number): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (node) await node.seek(guildId, position);
    const player = this.players.get(guildId);
    if (player) {
      player.position = position;
      player.positionTimestamp = Date.now();
    }
  }

  /**
   * Set volume
   */
  async setVolume(guildId: string, volume: number): Promise<void> {
    const queue = this.getQueue(guildId);
    queue.volume = Math.max(0, Math.min(1000, volume));
    const node = this.getNodeForGuild(guildId);
    if (node) await node.setVolume(guildId, queue.volume);
    const player = this.players.get(guildId);
    if (player) player.volume = queue.volume;
  }

  /**
   * Set loop mode
   */
  setLoopMode(guildId: string, mode: LoopMode): void {
    const queue = this.getQueue(guildId);
    queue.loopMode = mode;
    const player = this.players.get(guildId);
    if (player) player.loopMode = mode;
  }

  /**
   * Shuffle the queue
   */
  shuffle(guildId: string): void {
    const queue = this.queues.get(guildId);
    if (queue) queue.shuffle();
    const player = this.players.get(guildId);
    if (player && queue) player.queue = [...queue.tracks];
  }

  /**
   * Set audio filters
   */
  async setFilters(guildId: string, filters: Filters): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (node) await node.setFilters(guildId, filters);
  }

  /**
   * Clear all filters
   */
  async clearFilters(guildId: string): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (node) await node.clearFilters(guildId);
  }

  /**
   * Check if a member has DJ permissions
   * Admins (ADMINISTRATOR or ManageGuild) always have DJ permissions
   */
  hasDJPermissions(guildId: string, memberId: string): boolean {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return false;
    
    const member = guild.members.cache.get(memberId);
    if (!member) return false;

    // Admins always have DJ permissions
    if (member.permissions.has("Administrator") || member.permissions.has("ManageGuild")) {
      return true;
    }

    const guildSettings = this.settings.get(guildId);
    
    // If DJ-only mode is disabled or no DJ role is set, everyone has permissions
    if (!guildSettings.djRoleId || !guildSettings.djOnlyMode) return true;
    
    // Check if user has the DJ role
    return member.roles.cache.has(guildSettings.djRoleId);
  }

  /**
   * Get the number of listeners in the bot's voice channel
   */
  getListenerCount(guildId: string): number {
    const connection = this.voice.get(guildId);
    if (!connection) return 0;
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 0;
    const channel = guild.channels.cache.get(connection.channelId) as VoiceChannel | StageChannel | undefined;
    if (!channel) return 0;
    return channel.members.filter(m => !m.user.bot).size;
  }

  /**
   * Check if vote skip threshold is met
   */
  checkVoteSkip(guildId: string): { passed: boolean; current: number; required: number } {
    const guildSettings = this.settings.get(guildId);
    const queue = this.queues.get(guildId);
    if (!guildSettings.voteSkipEnabled || !queue) return { passed: true, current: 0, required: 0 };
    
    const listenerCount = this.getListenerCount(guildId);
    const voteCount = queue.voteCount;
    const requiredVotes = Math.ceil(listenerCount * (guildSettings.voteSkipPercentage / 100));
    
    return { passed: voteCount >= requiredVotes, current: voteCount, required: requiredVotes };
  }

  /**
   * Add a vote to skip and check if threshold is met
   */
  async voteSkip(guildId: string, userId: string): Promise<{ 
    success: boolean; skipped: boolean; current: number; required: number; alreadyVoted: boolean;
  }> {
    const queue = this.queues.get(guildId);
    if (!queue?.current) return { success: false, skipped: false, current: 0, required: 0, alreadyVoted: false };
    
    const alreadyVoted = queue.hasVoted(userId);
    if (alreadyVoted) {
      const check = this.checkVoteSkip(guildId);
      return { success: true, skipped: false, ...check, alreadyVoted: true };
    }
    
    queue.addSkipVote(userId);
    const check = this.checkVoteSkip(guildId);
    
    if (check.passed) {
      await this.skip(guildId);
      return { success: true, skipped: true, ...check, alreadyVoted: false };
    }
    
    return { success: true, skipped: false, ...check, alreadyVoted: false };
  }

  /**
   * Format duration (for backwards compatibility)
   * @deprecated Use formatDuration from @/utils/format instead
   */
  formatDuration(ms: number): string {
    return formatDuration(ms);
  }

  /**
   * Broadcast player update to WebSocket clients
   */
  broadcastPlayerUpdate(guildId: string): void {
    const apiServer = this.client.apiServer;
    if (!apiServer) return;

    const cachedPlayer = this.syncPlayerState(guildId);
    const guildSettings = this.settings.get(guildId);

    const formatTrack = (track: QueueTrack) => ({
      encoded: track.track.encoded,
      identifier: track.track.info.identifier,
      title: track.track.info.title,
      author: track.track.info.author,
      uri: track.track.info.uri,
      duration: track.track.info.length,
      artworkUrl: track.track.info.artworkUrl,
      sourceName: track.track.info.sourceName,
      isStream: track.track.info.isStream,
      requestedBy: { id: track.requesterId, username: track.requester, avatar: null },
    });

    apiServer.broadcastToGuild(guildId, {
      type: "playerUpdate",
      data: {
        playing: cachedPlayer.playing,
        paused: cachedPlayer.paused,
        current: cachedPlayer.current ? formatTrack(cachedPlayer.current) : null,
        queue: cachedPlayer.queue.map(formatTrack),
        position: cachedPlayer.position,
        volume: cachedPlayer.volume,
        loopMode: cachedPlayer.loopMode,
        settings: {
          defaultVolume: guildSettings.defaultVolume,
          djOnlyMode: guildSettings.djOnlyMode,
          twentyFourSevenMode: guildSettings.twentyFourSevenMode,
          autoplayEnabled: guildSettings.autoplayEnabled,
          voteSkipEnabled: guildSettings.voteSkipEnabled,
          voteSkipPercentage: guildSettings.voteSkipPercentage,
        },
      },
    });
  }

  /**
   * Cleanup guild resources
   */
  private cleanup(guildId: string): void {
    this.voice.delete(guildId);
    this.queues.delete(guildId);
    this.players.delete(guildId);
    this.nowPlaying.deleteMessage(guildId);
  }

  /**
   * Destroy all connections
   */
  async destroy(): Promise<void> {
    for (const node of this.nodes.values()) {
      node.disconnect();
    }
    this.nodes.clear();
    this.queues.clear();
    this.players.clear();
    this.voice.clear();
    this.nowPlaying.clear();
  }
}

// Re-export for convenience
export { Queue } from "./Queue.js";
export { LoopMode, type QueueTrack } from "@/types/music";
