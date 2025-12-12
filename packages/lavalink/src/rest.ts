import type {
  LavalinkNodeOptions,
  LoadResult,
  Track,
  Player,
  UpdatePlayerOptions,
  SessionInfo,
  SessionUpdate,
  LavalinkInfo,
  LavalinkStats,
  RoutePlannerStatus,
  LavalinkError,
} from "./types.js";

/**
 * Lavalink REST API client
 * Implements the Lavalink v4 REST API
 */
export class LavalinkRest {
  private readonly baseUrl: string;
  private readonly password: string;
  private sessionId: string | null = null;

  constructor(options: LavalinkNodeOptions) {
    const protocol = options.secure ? "https" : "http";
    const port = options.port ?? 2333;
    this.baseUrl = `${protocol}://${options.host}:${port}`;
    this.password = options.password;
  }

  /**
   * Set the session ID (called after WebSocket connection)
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Make a request to the Lavalink REST API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.password,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = (await response.json()) as LavalinkError;
      throw new Error(`Lavalink API Error: ${error.message} (${error.status})`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // ==================== Track API ====================

  /**
   * Load tracks from an identifier (URL, search query, etc.)
   * 
   * Search prefixes:
   * - `ytsearch:` - YouTube search
   * - `ytmsearch:` - YouTube Music search
   * - `scsearch:` - SoundCloud search
   */
  async loadTracks(identifier: string): Promise<LoadResult> {
    return this.request<LoadResult>(
      "GET",
      `/v4/loadtracks?identifier=${encodeURIComponent(identifier)}`
    );
  }

  /**
   * Decode a single track from its encoded string
   */
  async decodeTrack(encodedTrack: string): Promise<Track> {
    return this.request<Track>(
      "GET",
      `/v4/decodetrack?encodedTrack=${encodeURIComponent(encodedTrack)}`
    );
  }

  /**
   * Decode multiple tracks from their encoded strings
   */
  async decodeTracks(encodedTracks: string[]): Promise<Track[]> {
    return this.request<Track[]>("POST", "/v4/decodetracks", encodedTracks);
  }

  // ==================== Player API ====================

  /**
   * Get all players for this session
   */
  async getPlayers(): Promise<Player[]> {
    if (!this.sessionId) {
      throw new Error("Session ID not set. Connect to WebSocket first.");
    }
    return this.request<Player[]>("GET", `/v4/sessions/${this.sessionId}/players`);
  }

  /**
   * Get a specific player
   */
  async getPlayer(guildId: string): Promise<Player> {
    if (!this.sessionId) {
      throw new Error("Session ID not set. Connect to WebSocket first.");
    }
    return this.request<Player>(
      "GET",
      `/v4/sessions/${this.sessionId}/players/${guildId}`
    );
  }

  /**
   * Update or create a player
   */
  async updatePlayer(
    guildId: string,
    options: UpdatePlayerOptions,
    noReplace: boolean = false
  ): Promise<Player> {
    if (!this.sessionId) {
      throw new Error("Session ID not set. Connect to WebSocket first.");
    }
    const query = noReplace ? "?noReplace=true" : "";
    return this.request<Player>(
      "PATCH",
      `/v4/sessions/${this.sessionId}/players/${guildId}${query}`,
      options
    );
  }

  /**
   * Destroy a player
   */
  async destroyPlayer(guildId: string): Promise<void> {
    if (!this.sessionId) {
      throw new Error("Session ID not set. Connect to WebSocket first.");
    }
    return this.request<void>(
      "DELETE",
      `/v4/sessions/${this.sessionId}/players/${guildId}`
    );
  }

  // ==================== Convenience Player Methods ====================

  /**
   * Play a track on a player
   */
  async play(
    guildId: string,
    track: string | { encoded?: string; identifier?: string },
    options?: Omit<UpdatePlayerOptions, "track">
  ): Promise<Player> {
    const trackData = typeof track === "string" 
      ? { encoded: track } 
      : track;
    
    return this.updatePlayer(guildId, { ...options, track: trackData });
  }

  /**
   * Stop the current track
   */
  async stop(guildId: string): Promise<Player> {
    return this.updatePlayer(guildId, { track: { encoded: null } });
  }

  /**
   * Pause or resume playback
   */
  async pause(guildId: string, paused: boolean = true): Promise<Player> {
    return this.updatePlayer(guildId, { paused });
  }

  /**
   * Seek to a position in the current track
   */
  async seek(guildId: string, position: number): Promise<Player> {
    return this.updatePlayer(guildId, { position });
  }

  /**
   * Set the player volume
   */
  async setVolume(guildId: string, volume: number): Promise<Player> {
    return this.updatePlayer(guildId, { volume });
  }

  /**
   * Set player filters
   */
  async setFilters(
    guildId: string,
    filters: UpdatePlayerOptions["filters"]
  ): Promise<Player> {
    return this.updatePlayer(guildId, { filters });
  }

  /**
   * Update voice state (connect to voice channel)
   */
  async updateVoice(
    guildId: string,
    voice: UpdatePlayerOptions["voice"]
  ): Promise<Player> {
    return this.updatePlayer(guildId, { voice });
  }

  // ==================== Session API ====================

  /**
   * Update session configuration
   */
  async updateSession(options: SessionUpdate): Promise<SessionInfo> {
    if (!this.sessionId) {
      throw new Error("Session ID not set. Connect to WebSocket first.");
    }
    return this.request<SessionInfo>(
      "PATCH",
      `/v4/sessions/${this.sessionId}`,
      options
    );
  }

  // ==================== Info API ====================

  /**
   * Get Lavalink server info
   */
  async getInfo(): Promise<LavalinkInfo> {
    return this.request<LavalinkInfo>("GET", "/v4/info");
  }

  /**
   * Get Lavalink version string
   */
  async getVersion(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/version`, {
      headers: { Authorization: this.password },
    });
    return response.text();
  }

  /**
   * Get Lavalink statistics
   */
  async getStats(): Promise<LavalinkStats> {
    return this.request<LavalinkStats>("GET", "/v4/stats");
  }

  // ==================== Route Planner API ====================

  /**
   * Get route planner status
   */
  async getRoutePlannerStatus(): Promise<RoutePlannerStatus | null> {
    try {
      return await this.request<RoutePlannerStatus>(
        "GET",
        "/v4/routeplanner/status"
      );
    } catch {
      // 204 means route planner is not enabled
      return null;
    }
  }

  /**
   * Unmark a failed address
   */
  async unmarkFailedAddress(address: string): Promise<void> {
    return this.request<void>("POST", "/v4/routeplanner/free/address", {
      address,
    });
  }

  /**
   * Unmark all failed addresses
   */
  async unmarkAllFailedAddresses(): Promise<void> {
    return this.request<void>("POST", "/v4/routeplanner/free/all");
  }
}
