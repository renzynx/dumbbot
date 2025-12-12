import {
  LavalinkNode,
  type LavalinkNodeOptions,
  type Track,
  type LoadResult,
  type Filters,
} from "@discordbot/lavalink";
import {
  GatewayDispatchEvents,
  type GatewayVoiceServerUpdateDispatchData,
  type GatewayVoiceStateUpdateDispatchData,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type Message,
  type ButtonInteraction,
  type VoiceChannel,
  type StageChannel,
} from "discord.js";
import type { BotClient } from "@/core/Client";
import { Queue, LoopMode, type QueueTrack } from "./Queue.js";
import { Logger } from "@/utils/Logger";
import { GuildSettingsManager } from "./GuildSettings.js";

export interface MusicManagerOptions {
  nodes: Omit<LavalinkNodeOptions, "userId">[];
  defaultVolume?: number;
  defaultSearchPlatform?: "youtube" | "youtubemusic" | "soundcloud";
}

export interface VoiceConnection {
  guildId: string;
  channelId: string;
  sessionId: string;
  token?: string;
  endpoint?: string;
}

/**
 * Music manager - handles Lavalink nodes and guild queues
 */
export class MusicManager {
  public readonly client: BotClient;
  public readonly nodes = new Map<string, LavalinkNode>();
  public readonly queues = new Map<string, Queue>();
  public readonly voiceConnections = new Map<string, VoiceConnection>();
  public readonly settings = new GuildSettingsManager();
  
  private readonly logger = new Logger("Music");
  private readonly options: MusicManagerOptions;
  private readonly pendingConnections = new Map<string, {
    resolve: (value: void) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private readonly nowPlayingMessages = new Map<string, Message>();

  constructor(client: BotClient, options: MusicManagerOptions) {
    this.client = client;
    this.options = options;

    this.setupVoiceHandlers();
    this.setupButtonHandler();
  }

  /**
   * Initialize all Lavalink nodes
   */
  async initialize(): Promise<void> {
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
        // Clear skip votes on new track
        queue.clearSkipVotes();
        
        if (queue.textChannelId) {
          this.sendNowPlaying(queue);
        }

        // Broadcast to WebSocket clients
        this.broadcastPlayerUpdate(event.guildId);
      }
    });

    node.on("trackEnd", async (event) => {
      const queue = this.queues.get(event.guildId);
      if (!queue) return;

      // Add finished track to history
      if (queue.current && event.reason === "finished") {
        queue.addToHistory(queue.current);
      }

      // Don't auto-play if track was replaced or stopped
      if (event.reason === "replaced" || event.reason === "stopped") {
        return;
      }

      // Try to play next track
      const next = queue.next();
      if (next) {
        await this.playTrack(event.guildId, next);
      } else {
        // Queue is empty - broadcast the update
        this.broadcastPlayerUpdate(event.guildId);
        
        // Check for autoplay or 24/7 mode
        const guildSettings = this.settings.get(event.guildId);
        
        if (guildSettings.autoplayEnabled && queue.previous) {
          // Try to find similar track
          await this.tryAutoplay(event.guildId, queue.previous);
        } else if (!guildSettings.twentyFourSevenMode) {
          // Not in 24/7 mode and no autoplay, disconnect after timeout
          setTimeout(() => {
            const currentQueue = this.queues.get(event.guildId);
            if (currentQueue && !currentQueue.current && currentQueue.size === 0) {
              this.disconnect(event.guildId);
            }
          }, 30000); // 30 second idle timeout
        }
        // If 24/7 mode is enabled, stay connected
      }
    });

    node.on("trackException", (event) => {
      this.logger.error(`Track exception in ${event.guildId}:`, event.exception);
      const queue = this.queues.get(event.guildId);
      if (queue) {
        // Skip to next track on error
        const next = queue.next();
        if (next) {
          this.playTrack(event.guildId, next);
        }
      }
    });

    node.on("trackStuck", async (event) => {
      this.logger.warn(`Track stuck in ${event.guildId}, skipping...`);
      const queue = this.queues.get(event.guildId);
      if (queue) {
        const next = queue.next();
        if (next) {
          await this.playTrack(event.guildId, next);
        }
      }
    });

    node.on("websocketClosed", (event) => {
      this.logger.warn(`WebSocket closed for ${event.guildId}: ${event.code} - ${event.reason}`);
      // Clean up if Discord closed the connection
      if (event.byRemote) {
        this.cleanup(event.guildId);
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
      
      // Check if user is in voice channel
      if (!member?.voice.channel) {
        await interaction.reply({
          content: "You need to be in a voice channel to use music controls!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check if user is in the same voice channel as the bot
      const botVoiceChannel = this.voiceConnections.get(guildId)?.channelId;
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
    interaction: ButtonInteraction,
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
          await interaction.reply({ content: "▶️ Resumed playback", flags: MessageFlags.Ephemeral });
        } else {
          await this.pause(guildId);
          await interaction.reply({ content: "⏸️ Paused playback", flags: MessageFlags.Ephemeral });
        }
        await this.updateNowPlayingMessage(guildId);
        break;
      }

      case "skip": {
        if (!queue?.current) {
          await interaction.reply({ content: "Nothing is playing!", flags: MessageFlags.Ephemeral });
          return;
        }
        const skipped = await this.skip(guildId);
        await interaction.reply({
          content: skipped ? `⏭️ Skipped **${skipped.track.info.title}**` : "⏭️ Skipped",
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "stop": {
        await this.stop(guildId);
        await this.disconnect(guildId);
        await interaction.reply({ content: "⏹️ Stopped playback and disconnected", flags: MessageFlags.Ephemeral });
        
        // Delete the now playing message
        const msg = this.nowPlayingMessages.get(guildId);
        if (msg) {
          try {
            await msg.delete();
          } catch {
            // Message might already be deleted
          }
          this.nowPlayingMessages.delete(guildId);
        }
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
        
        // Cycle through loop modes: None -> Track -> Queue -> None
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
        await this.updateNowPlayingMessage(guildId);
        break;
      }

      case "queue": {
        if (!queue || (queue.size === 0 && !queue.current)) {
          await interaction.reply({ content: "The queue is empty!", flags: MessageFlags.Ephemeral });
          return;
        }

        await this.showQueuePage(interaction, queue, 0);
        break;
      }

      default: {
        // Handle queue pagination
        if (action.startsWith("queue_page_")) {
          const page = parseInt(action.replace("queue_page_", ""), 10);
          if (!isNaN(page) && queue) {
            await this.handleQueuePagination(interaction, queue, page);
          }
          return;
        }
        await interaction.reply({ content: "Unknown action", flags: MessageFlags.Ephemeral });
      }
    }
  }

  /**
   * Show a page of the queue
   */
  private async showQueuePage(
    interaction: ButtonInteraction,
    queue: Queue,
    page: number
  ): Promise<void> {
    const { embed, components } = this.createQueueEmbed(queue, page);
    await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
  }

  /**
   * Handle queue pagination button
   */
  private async handleQueuePagination(
    interaction: ButtonInteraction,
    queue: Queue,
    page: number
  ): Promise<void> {
    const { embed, components } = this.createQueueEmbed(queue, page);
    await interaction.update({ embeds: [embed], components });
  }

  /**
   * Create queue embed with pagination
   */
  private createQueueEmbed(
    queue: Queue,
    page: number
  ): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
    const itemsPerPage = 10;
    const totalPages = Math.max(1, Math.ceil(queue.size / itemsPerPage));
    const currentPage = Math.max(0, Math.min(page, totalPages - 1));
    
    const startIndex = currentPage * itemsPerPage;
    const tracks = queue.tracks.slice(startIndex, startIndex + itemsPerPage);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Queue")
      .setDescription(
        tracks.length > 0
          ? tracks
              .map((t, i) => `**${startIndex + i + 1}.** ${t.track.info.title} - ${t.track.info.author}`)
              .join("\n")
          : "No tracks in queue"
      )
      .setFooter({
        text: `Page ${currentPage + 1}/${totalPages} • ${queue.size} track${queue.size !== 1 ? "s" : ""} • Total: ${this.formatDuration(queue.totalDuration)}`,
      });

    if (queue.current) {
      embed.addFields({
        name: "Now Playing",
        value: `${queue.current.track.info.title} - ${queue.current.track.info.author}`,
      });
    }

    // Create pagination buttons
    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    
    if (totalPages > 1) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`music_queue_page_0`)
          .setEmoji("⏮️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId(`music_queue_page_${currentPage - 1}`)
          .setEmoji("◀️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId("music_queue_page_current")
          .setLabel(`${currentPage + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`music_queue_page_${currentPage + 1}`)
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === totalPages - 1),
        new ButtonBuilder()
          .setCustomId(`music_queue_page_${totalPages - 1}`)
          .setEmoji("⏭️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === totalPages - 1)
      );
      components.push(row);
    }

    return { embed, components };
  }

  /**
   * Update the now playing message with current state
   */
  private async updateNowPlayingMessage(guildId: string): Promise<void> {
    const message = this.nowPlayingMessages.get(guildId);
    const queue = this.queues.get(guildId);
    
    if (!message || !queue?.current) return;

    try {
      const { embed, components } = this.createNowPlayingEmbed(queue, guildId);
      await message.edit({ embeds: [embed], components });
    } catch {
      // Message might be deleted
      this.nowPlayingMessages.delete(guildId);
    }
  }

  /**
   * Setup Discord voice state handlers
   */
  private setupVoiceHandlers(): void {
    // Handle voice state updates (when bot joins/leaves/moves)
    this.client.on("raw", async (packet: { t: string; d: unknown }) => {
      if (packet.t === GatewayDispatchEvents.VoiceStateUpdate) {
        const data = packet.d as GatewayVoiceStateUpdateDispatchData;
        
        // Only handle our own voice state
        if (data.user_id !== this.client.user?.id) return;

        const connection = this.voiceConnections.get(data.guild_id!);
        if (connection) {
          connection.sessionId = data.session_id;
          
          // If we have all the info, update the player
          if (connection.token && connection.endpoint) {
            await this.updateVoiceState(data.guild_id!);
          }
        }
      }

      if (packet.t === GatewayDispatchEvents.VoiceServerUpdate) {
        const data = packet.d as GatewayVoiceServerUpdateDispatchData;
        
        const connection = this.voiceConnections.get(data.guild_id);
        if (connection) {
          connection.token = data.token;
          connection.endpoint = data.endpoint ?? undefined;
          
          // Update the player with voice info
          await this.updateVoiceState(data.guild_id);
        }
      }
    });
  }

  /**
   * Update Lavalink with voice connection info
   */
  private async updateVoiceState(guildId: string): Promise<void> {
    const connection = this.voiceConnections.get(guildId);
    if (!connection?.token || !connection.endpoint) return;

    const node = this.getIdealNode();
    if (!node) return;

    try {
      await node.joinChannel(guildId, {
        token: connection.token,
        endpoint: connection.endpoint,
        sessionId: connection.sessionId,
      });

      // Resolve any pending connection promise
      const pending = this.pendingConnections.get(guildId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve();
        this.pendingConnections.delete(guildId);
      }
    } catch (error) {
      this.logger.error(`Failed to update voice state for ${guildId}:`, error);
      
      const pending = this.pendingConnections.get(guildId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.reject(error as Error);
        this.pendingConnections.delete(guildId);
      }
    }
  }

  /**
   * Get the best available node
   */
  getIdealNode(): LavalinkNode | null {
    let bestNode: LavalinkNode | null = null;
    let bestPenalty = Infinity;

    for (const node of Array.from(this.nodes.values())) {
      if (!node.connected) continue;

      const stats = node.getStats();
      if (!stats) {
        bestNode = node;
        continue;
      }

      // Calculate penalty based on load
      const penalty = stats.cpu.systemLoad + (stats.players * 5);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestNode = node;
      }
    }

    return bestNode;
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
   * Connect to a voice channel
   */
  async connect(guildId: string, channelId: string): Promise<void> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error("Guild not found");
    }

    // Store connection info
    this.voiceConnections.set(guildId, {
      guildId,
      channelId,
      sessionId: "",
    });

    // Create a promise that resolves when we receive voice server update
    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingConnections.delete(guildId);
        reject(new Error("Voice connection timed out"));
      }, 15000);

      this.pendingConnections.set(guildId, { resolve, reject, timeout });
    });

    // Tell Discord to connect us to the voice channel
    await guild.shard.send({
      op: 4, // VOICE_STATE_UPDATE
      d: {
        guild_id: guildId,
        channel_id: channelId,
        self_mute: false,
        self_deaf: true,
      },
    });

    // Wait for voice connection to be established
    await connectionPromise;

    // Update queue with voice channel
    const queue = this.getQueue(guildId);
    queue.voiceChannelId = channelId;
  }

  /**
   * Disconnect from voice
   */
  async disconnect(guildId: string): Promise<void> {
    const guild = this.client.guilds.cache.get(guildId);
    if (guild) {
      await guild.shard.send({
        op: 4,
        d: {
          guild_id: guildId,
          channel_id: null,
          self_mute: false,
          self_deaf: false,
        },
      });
    }

    const node = this.getNodeForGuild(guildId);
    if (node) {
      try {
        await node.leaveChannel(guildId);
      } catch {
        // Ignore errors when leaving
      }
    }

    this.cleanup(guildId);
  }

  /**
   * Search for tracks
   */
  async search(query: string, platform?: string): Promise<LoadResult> {
    const node = this.getIdealNode();
    if (!node) {
      throw new Error("No available Lavalink nodes");
    }

    // If it's a URL, load directly
    if (query.startsWith("http://") || query.startsWith("https://")) {
      return node.loadTracks(query);
    }

    // Otherwise, search using the specified platform
    const searchPlatform = platform ?? this.options.defaultSearchPlatform ?? "youtube";
    
    switch (searchPlatform) {
      case "youtubemusic":
        return node.searchYouTubeMusic(query);
      case "soundcloud":
        return node.searchSoundCloud(query);
      default:
        return node.searchYouTube(query);
    }
  }

  /**
   * Play a track
   */
  async playTrack(guildId: string, queueTrack: QueueTrack): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (!node) {
      throw new Error("No node available for this guild");
    }

    const queue = this.getQueue(guildId);
    queue.current = queueTrack;

    await node.play(guildId, queueTrack.track, {
      volume: queue.volume,
    });
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

    // Add tracks to queue
    queue.addMany(trackArray, requester, requesterId);

    // If nothing is playing, start playback
    if (!queue.current) {
      const next = queue.next();
      if (next) {
        await this.playTrack(guildId, next);
      }
    }

    return {
      position: queue.size,
      tracks: trackArray,
    };
  }

  /**
   * Skip the current track
   */
  async skip(guildId: string): Promise<QueueTrack | null> {
    const queue = this.queues.get(guildId);
    if (!queue) return null;

    const skipped = queue.current;
    
    // Add to history before skipping
    if (skipped) {
      queue.addToHistory(skipped);
    }
    
    const next = queue.next();

    if (next) {
      await this.playTrack(guildId, next);
    } else {
      await this.stop(guildId);
    }

    return skipped;
  }

  /**
   * Try to autoplay a similar track
   */
  async tryAutoplay(guildId: string, lastTrack: QueueTrack): Promise<boolean> {
    try {
      // Search for similar tracks based on the last track
      const query = `${lastTrack.track.info.author} ${lastTrack.track.info.title.split(/[(\-\[\|]/)[0]?.trim() || lastTrack.track.info.title}`;
      
      const result = await this.search(query);
      
      if (result.loadType === "search" && result.data.length > 0) {
        // Find a track that's different from recent history
        const queue = this.getQueue(guildId);
        const recentHistory = queue.getHistory(10);
        const recentUris = new Set(recentHistory.map(h => h.track.info.uri));
        
        // Also avoid the last played track
        if (lastTrack.track.info.uri) {
          recentUris.add(lastTrack.track.info.uri);
        }
        
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
    if (node) {
      await node.stop(guildId);
    }

    const queue = this.queues.get(guildId);
    if (queue) {
      queue.current = null;
      queue.clear();
    }
  }

  /**
   * Pause playback
   */
  async pause(guildId: string): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (node) {
      await node.pause(guildId);
    }
  }

  /**
   * Resume playback
   */
  async resume(guildId: string): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (node) {
      await node.resume(guildId);
    }
  }

  /**
   * Seek to a position
   */
  async seek(guildId: string, position: number): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (node) {
      await node.seek(guildId, position);
    }
  }

  /**
   * Set volume
   */
  async setVolume(guildId: string, volume: number): Promise<void> {
    const queue = this.getQueue(guildId);
    queue.volume = Math.max(0, Math.min(1000, volume));

    const node = this.getNodeForGuild(guildId);
    if (node) {
      await node.setVolume(guildId, queue.volume);
    }
  }

  /**
   * Set loop mode
   */
  setLoopMode(guildId: string, mode: LoopMode): void {
    const queue = this.getQueue(guildId);
    queue.loopMode = mode;
  }

  /**
   * Shuffle the queue
   */
  shuffle(guildId: string): void {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.shuffle();
    }
  }

  /**
   * Set audio filters
   */
  async setFilters(guildId: string, filters: Filters): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (node) {
      await node.setFilters(guildId, filters);
    }
  }

  /**
   * Clear all filters
   */
  async clearFilters(guildId: string): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (node) {
      await node.clearFilters(guildId);
    }
  }

  /**
   * Check if a member has DJ permissions
   */
  hasDJPermissions(guildId: string, memberId: string, isAdmin: boolean = false): boolean {
    // Admins always have DJ permissions
    if (isAdmin) return true;
    
    const guildSettings = this.settings.get(guildId);
    
    // If no DJ role set or DJ-only mode is off, everyone can use commands
    if (!guildSettings.djRoleId || !guildSettings.djOnlyMode) {
      return true;
    }
    
    // Check if member has the DJ role
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return false;
    
    const member = guild.members.cache.get(memberId);
    if (!member) return false;
    
    return member.roles.cache.has(guildSettings.djRoleId);
  }

  /**
   * Get the number of listeners in the bot's voice channel (excluding bots)
   */
  getListenerCount(guildId: string): number {
    const connection = this.voiceConnections.get(guildId);
    if (!connection) return 0;
    
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return 0;
    
    const channel = guild.channels.cache.get(connection.channelId) as VoiceChannel | StageChannel | undefined;
    if (!channel) return 0;
    
    // Count non-bot members
    return channel.members.filter(m => !m.user.bot).size;
  }

  /**
   * Check if vote skip threshold is met
   */
  checkVoteSkip(guildId: string): { passed: boolean; current: number; required: number } {
    const guildSettings = this.settings.get(guildId);
    const queue = this.queues.get(guildId);
    
    if (!guildSettings.voteSkipEnabled || !queue) {
      return { passed: true, current: 0, required: 0 };
    }
    
    const listenerCount = this.getListenerCount(guildId);
    const voteCount = queue.voteCount;
    const requiredVotes = Math.ceil(listenerCount * (guildSettings.voteSkipPercentage / 100));
    
    return {
      passed: voteCount >= requiredVotes,
      current: voteCount,
      required: requiredVotes,
    };
  }

  /**
   * Add a vote to skip and check if threshold is met
   */
  async voteSkip(guildId: string, userId: string): Promise<{ 
    success: boolean; 
    skipped: boolean; 
    current: number; 
    required: number;
    alreadyVoted: boolean;
  }> {
    const queue = this.queues.get(guildId);
    if (!queue?.current) {
      return { success: false, skipped: false, current: 0, required: 0, alreadyVoted: false };
    }
    
    const alreadyVoted = queue.hasVoted(userId);
    if (alreadyVoted) {
      const check = this.checkVoteSkip(guildId);
      return { success: true, skipped: false, current: check.current, required: check.required, alreadyVoted: true };
    }
    
    queue.addSkipVote(userId);
    const check = this.checkVoteSkip(guildId);
    
    if (check.passed) {
      await this.skip(guildId);
      return { success: true, skipped: true, current: check.current, required: check.required, alreadyVoted: false };
    }
    
    return { success: true, skipped: false, current: check.current, required: check.required, alreadyVoted: false };
  }

  /**
   * Get the node handling a guild
   */
  private getNodeForGuild(guildId: string): LavalinkNode | null {
    // For now, just return the ideal node
    // In a more advanced setup, you'd track which node handles which guild
    return this.getIdealNode();
  }

  /**
   * Create the now playing embed with buttons
   */
  private createNowPlayingEmbed(queue: Queue, guildId: string): { 
    embed: EmbedBuilder; 
    components: ActionRowBuilder<ButtonBuilder>[];
  } {
    const track = queue.current!.track;
    const node = this.getNodeForGuild(guildId);
    const player = node?.getPlayer(guildId);
    const isPaused = player?.paused ?? false;

    const embed = new EmbedBuilder()
      .setColor(isPaused ? 0xfee75c : 0x57f287)
      .setAuthor({ name: isPaused ? "Paused" : "Now Playing" })
      .setTitle(track.info.title)
      .setURL(track.info.uri ?? null)
      .setDescription(`By **${track.info.author || "Unknown"}**`)
      .addFields(
        {
          name: "Duration",
          value: this.formatDuration(track.info.length),
          inline: true,
        },
        {
          name: "Requested by",
          value: queue.current!.requester,
          inline: true,
        },
        {
          name: "Queue",
          value: `${queue.size} track${queue.size !== 1 ? "s" : ""}`,
          inline: true,
        }
      );

    if (track.info.artworkUrl) {
      embed.setThumbnail(track.info.artworkUrl);
    }

    // Add loop indicator
    if (queue.loopMode !== LoopMode.None) {
      const loopText = queue.loopMode === LoopMode.Track ? "🔂 Track" : "🔁 Queue";
      embed.setFooter({ text: `Loop: ${loopText}` });
    }

    // Create button rows
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("music_pause_resume")
        .setEmoji(isPaused ? "▶️" : "⏸️")
        .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music_skip")
        .setEmoji("⏭️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("music_stop")
        .setEmoji("⏹️")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("music_shuffle")
        .setEmoji("🔀")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music_loop")
        .setEmoji(queue.loopMode === LoopMode.Track ? "🔂" : "🔁")
        .setStyle(queue.loopMode !== LoopMode.None ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("music_queue")
        .setLabel("View Queue")
        .setEmoji("📜")
        .setStyle(ButtonStyle.Secondary)
    );

    return { embed, components: [row1, row2] };
  }

  /**
   * Send now playing message with button controls
   */
  private async sendNowPlaying(queue: Queue): Promise<void> {
    if (!queue.current || !queue.textChannelId) return;

    try {
      const channel = await this.client.channels.fetch(queue.textChannelId);
      if (!channel?.isTextBased() || !("send" in channel)) return;

      // Delete previous now playing message
      const previousMessage = this.nowPlayingMessages.get(queue.guildId);
      if (previousMessage) {
        try {
          await previousMessage.delete();
        } catch {
          // Message might already be deleted
        }
      }

      const { embed, components } = this.createNowPlayingEmbed(queue, queue.guildId);
      const message = await channel.send({ embeds: [embed], components });
      
      this.nowPlayingMessages.set(queue.guildId, message);
    } catch (error) {
      this.logger.error("Failed to send now playing message:", error);
    }
  }

  /**
   * Format duration in mm:ss or hh:mm:ss
   */
  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
  }

  /**
   * Broadcast player update to WebSocket clients
   */
  broadcastPlayerUpdate(guildId: string): void {
    const apiServer = this.client.apiServer;
    if (!apiServer) return;

    const queue = this.queues.get(guildId);
    const node = this.getIdealNode();
    const player = node?.getPlayer(guildId);

    const formatTrack = (track: QueueTrack) => ({
      identifier: track.track.info.identifier,
      title: track.track.info.title,
      author: track.track.info.author,
      uri: track.track.info.uri,
      duration: track.track.info.length,
      artworkUrl: track.track.info.artworkUrl,
      sourceName: track.track.info.sourceName,
      isStream: track.track.info.isStream,
      requestedBy: {
        id: track.requesterId,
        username: track.requester,
        avatar: null,
      },
    });

    const guildSettings = this.settings.get(guildId);

    apiServer.broadcastToGuild(guildId, {
      type: "playerUpdate",
      data: {
        playing: !!queue?.current,
        paused: player?.paused ?? false,
        current: queue?.current ? formatTrack(queue.current) : null,
        queue: queue?.tracks.map((t) => formatTrack(t)) ?? [],
        position: player?.state.position ?? 0,
        volume: queue?.volume ?? guildSettings.defaultVolume,
        loopMode: queue?.loopMode ?? LoopMode.None,
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
    this.voiceConnections.delete(guildId);
    this.queues.delete(guildId);
    this.pendingConnections.delete(guildId);
    
    // Try to delete the now playing message
    const message = this.nowPlayingMessages.get(guildId);
    if (message) {
      message.delete().catch(() => {});
      this.nowPlayingMessages.delete(guildId);
    }
  }

  /**
   * Destroy all connections
   */
  async destroy(): Promise<void> {
    for (const node of Array.from(this.nodes.values())) {
      node.disconnect();
    }
    this.nodes.clear();
    this.queues.clear();
    this.voiceConnections.clear();
    this.nowPlayingMessages.clear();
  }
}

// Re-export for convenience
export { Queue, LoopMode, type QueueTrack };
