import { LavalinkRest } from "./rest.js";
import { LavalinkSocket, type LavalinkSocketEvents } from "./socket.js";
import type {
  LavalinkNodeOptions,
  Player,
  Track,
  LoadResult,
  UpdatePlayerOptions,
  Filters,
  VoiceState,
  LavalinkStats,
  LavalinkInfo,
} from "./types.js";

export interface LavalinkNodeEvents extends LavalinkSocketEvents {
  connected: (sessionId: string, resumed: boolean) => void;
  disconnected: (code: number, reason: string) => void;
}

type EventCallback<K extends keyof LavalinkNodeEvents> = LavalinkNodeEvents[K];

/**
 * Lavalink Node - combines REST API and WebSocket functionality
 * This is the main class you should use to interact with Lavalink
 */
export class LavalinkNode {
  public readonly rest: LavalinkRest;
  public readonly socket: LavalinkSocket;
  
  private readonly _options: LavalinkNodeOptions;
  private readonly players = new Map<string, Player>();
  private stats: LavalinkStats | null = null;
  private readonly listeners = new Map<keyof LavalinkNodeEvents, Set<EventCallback<any>>>();

  constructor(options: LavalinkNodeOptions) {
    this._options = options;
    this.rest = new LavalinkRest(options);
    this.socket = new LavalinkSocket(options);

    this.setupSocketEvents();
  }

  /**
   * Get the node options
   */
  get options(): LavalinkNodeOptions {
    return this._options;
  }

  /**
   * Get the session ID
   */
  get sessionId(): string | null {
    return this.socket.getSessionId();
  }

  /**
   * Check if connected to Lavalink
   */
  get connected(): boolean {
    return this.socket.isConnected();
  }

  /**
   * Get cached stats
   */
  getStats(): LavalinkStats | null {
    return this.stats;
  }

  /**
   * Get a cached player
   */
  getPlayer(guildId: string): Player | undefined {
    return this.players.get(guildId);
  }

  /**
   * Get all cached players
   */
  getPlayers(): Map<string, Player> {
    return this.players;
  }

  /**
   * Setup internal socket event handlers
   */
  private setupSocketEvents(): void {
    this.socket.on("ready", (data) => {
      this.rest.setSessionId(data.sessionId);
      this.emit("connected", data.sessionId, data.resumed);
      this.emit("ready", data);
    });

    this.socket.on("close", (code, reason) => {
      this.emit("disconnected", code, reason);
      this.emit("close", code, reason);
    });

    this.socket.on("stats", (stats) => {
      this.stats = stats;
      this.emit("stats", stats);
    });

    this.socket.on("playerUpdate", (guildId, state) => {
      const player = this.players.get(guildId);
      if (player) {
        player.state = state;
      }
      this.emit("playerUpdate", guildId, state);
    });

    // Forward all other events
    this.socket.on("event", (event) => this.emit("event", event));
    this.socket.on("trackStart", (event) => this.emit("trackStart", event));
    this.socket.on("trackEnd", (event) => {
      // Clear track from cache when it ends
      const player = this.players.get(event.guildId);
      if (player) {
        player.track = null;
      }
      this.emit("trackEnd", event);
    });
    this.socket.on("trackException", (event) => this.emit("trackException", event));
    this.socket.on("trackStuck", (event) => this.emit("trackStuck", event));
    this.socket.on("websocketClosed", (event) => this.emit("websocketClosed", event));
    this.socket.on("error", (error) => this.emit("error", error));
    this.socket.on("raw", (message) => this.emit("raw", message));
  }

  // ==================== Connection Methods ====================

  /**
   * Connect to the Lavalink server
   */
  connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      const onReady = (data: { sessionId: string }) => {
        this.socket.off("ready", onReady);
        this.socket.off("error", onError);
        resolve(data.sessionId);
      };

      const onError = (error: Error) => {
        this.socket.off("ready", onReady);
        this.socket.off("error", onError);
        reject(error);
      };

      this.socket.on("ready", onReady);
      this.socket.on("error", onError);
      this.socket.connect();
    });
  }

  /**
   * Disconnect from the Lavalink server
   */
  disconnect(): void {
    this.socket.disconnect();
  }

  // ==================== Track Methods ====================

  /**
   * Load tracks from an identifier
   */
  async loadTracks(identifier: string): Promise<LoadResult> {
    return this.rest.loadTracks(identifier);
  }

  /**
   * Search for tracks on YouTube
   */
  async searchYouTube(query: string): Promise<LoadResult> {
    return this.rest.loadTracks(`ytsearch:${query}`);
  }

  /**
   * Search for tracks on YouTube Music
   */
  async searchYouTubeMusic(query: string): Promise<LoadResult> {
    return this.rest.loadTracks(`ytmsearch:${query}`);
  }

  /**
   * Search for tracks on SoundCloud
   */
  async searchSoundCloud(query: string): Promise<LoadResult> {
    return this.rest.loadTracks(`scsearch:${query}`);
  }

  /**
   * Decode an encoded track
   */
  async decodeTrack(encoded: string): Promise<Track> {
    return this.rest.decodeTrack(encoded);
  }

  /**
   * Decode multiple encoded tracks
   */
  async decodeTracks(encoded: string[]): Promise<Track[]> {
    return this.rest.decodeTracks(encoded);
  }

  // ==================== Player Methods ====================

  /**
   * Create or update a player and connect to a voice channel
   */
  async joinChannel(
    guildId: string,
    voice: VoiceState
  ): Promise<Player> {
    const player = await this.rest.updateVoice(guildId, voice);
    this.players.set(guildId, player);
    return player;
  }

  /**
   * Destroy a player and disconnect from voice
   */
  async leaveChannel(guildId: string): Promise<void> {
    await this.rest.destroyPlayer(guildId);
    this.players.delete(guildId);
  }

  /**
   * Play a track
   */
  async play(
    guildId: string,
    track: string | Track | { identifier: string },
    options?: Omit<UpdatePlayerOptions, "track">
  ): Promise<Player> {
    let trackData: { encoded?: string; identifier?: string };

    if (typeof track === "string") {
      trackData = { encoded: track };
    } else if ("encoded" in track) {
      trackData = { encoded: track.encoded };
    } else {
      trackData = { identifier: track.identifier };
    }

    const player = await this.rest.updatePlayer(guildId, {
      ...options,
      track: trackData,
    });
    this.players.set(guildId, player);
    return player;
  }

  /**
   * Stop the current track
   */
  async stop(guildId: string): Promise<Player> {
    const player = await this.rest.stop(guildId);
    this.players.set(guildId, player);
    return player;
  }

  /**
   * Pause playback
   */
  async pause(guildId: string): Promise<Player> {
    const player = await this.rest.pause(guildId, true);
    this.players.set(guildId, player);
    return player;
  }

  /**
   * Resume playback
   */
  async resume(guildId: string): Promise<Player> {
    const player = await this.rest.pause(guildId, false);
    this.players.set(guildId, player);
    return player;
  }

  /**
   * Seek to a position (in milliseconds)
   */
  async seek(guildId: string, position: number): Promise<Player> {
    const player = await this.rest.seek(guildId, position);
    this.players.set(guildId, player);
    return player;
  }

  /**
   * Set the volume (0-1000)
   */
  async setVolume(guildId: string, volume: number): Promise<Player> {
    const player = await this.rest.setVolume(guildId, volume);
    this.players.set(guildId, player);
    return player;
  }

  /**
   * Set filters
   */
  async setFilters(guildId: string, filters: Filters): Promise<Player> {
    const player = await this.rest.setFilters(guildId, filters);
    this.players.set(guildId, player);
    return player;
  }

  /**
   * Clear all filters
   */
  async clearFilters(guildId: string): Promise<Player> {
    return this.setFilters(guildId, {});
  }

  /**
   * Update player with custom options
   */
  async updatePlayer(
    guildId: string,
    options: UpdatePlayerOptions,
    noReplace?: boolean
  ): Promise<Player> {
    const player = await this.rest.updatePlayer(guildId, options, noReplace);
    this.players.set(guildId, player);
    return player;
  }

  /**
   * Fetch fresh player state from Lavalink
   */
  async fetchPlayer(guildId: string): Promise<Player> {
    const player = await this.rest.getPlayer(guildId);
    this.players.set(guildId, player);
    return player;
  }

  /**
   * Fetch all players from Lavalink
   */
  async fetchPlayers(): Promise<Player[]> {
    const players = await this.rest.getPlayers();
    for (const player of players) {
      this.players.set(player.guildId, player);
    }
    return players;
  }

  // ==================== Info Methods ====================

  /**
   * Get Lavalink server info
   */
  async getInfo(): Promise<LavalinkInfo> {
    return this.rest.getInfo();
  }

  /**
   * Get Lavalink version
   */
  async getVersion(): Promise<string> {
    return this.rest.getVersion();
  }

  /**
   * Fetch fresh stats from Lavalink
   */
  async fetchStats(): Promise<LavalinkStats> {
    const stats = await this.rest.getStats();
    this.stats = stats;
    return stats;
  }

  // ==================== Session Methods ====================

  /**
   * Enable session resuming
   */
  async enableResuming(timeout: number = 60): Promise<void> {
    await this.rest.updateSession({ resuming: true, timeout });
  }

  /**
   * Disable session resuming
   */
  async disableResuming(): Promise<void> {
    await this.rest.updateSession({ resuming: false });
  }

  // ==================== Event Emitter ====================

  on<K extends keyof LavalinkNodeEvents>(
    event: K,
    callback: EventCallback<K>
  ): this {
    let listeners = this.listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(event, listeners);
    }
    listeners.add(callback);
    return this;
  }

  once<K extends keyof LavalinkNodeEvents>(
    event: K,
    callback: EventCallback<K>
  ): this {
    const onceCallback = ((...args: unknown[]) => {
      this.off(event, onceCallback as EventCallback<K>);
      (callback as (...args: unknown[]) => void)(...args);
    }) as EventCallback<K>;
    return this.on(event, onceCallback);
  }

  off<K extends keyof LavalinkNodeEvents>(
    event: K,
    callback: EventCallback<K>
  ): this {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
    return this;
  }

  private emit<K extends keyof LavalinkNodeEvents>(
    event: K,
    ...args: Parameters<LavalinkNodeEvents[K]>
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          (callback as (...args: unknown[]) => void)(...args);
        } catch (error) {
          console.error(`Error in ${String(event)} listener:`, error);
        }
      }
    }
  }

  removeAllListeners(event?: keyof LavalinkNodeEvents): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}
