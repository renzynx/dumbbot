import { eq, and, or } from "drizzle-orm";
import { db } from "@/db";
import { playlists, playlistTracks, guildSettings } from "@/db/schema";
import type { Playlist, GuildSettingsRow } from "@/db/schema";

/**
 * Per-guild music settings interface
 */
export interface GuildMusicSettings {
  guildId: string;
  djRoleId: string | null;
  djOnlyMode: boolean;
  twentyFourSevenMode: boolean;
  autoplayEnabled: boolean;
  defaultVolume: number;
  voteSkipEnabled: boolean;
  voteSkipPercentage: number;
}

/**
 * Saved playlist with tracks (for API responses)
 */
export interface SavedPlaylist {
  id: string;
  name: string;
  guildId: string;
  ownerId: string;
  ownerName: string;
  tracks: SavedTrack[];
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
}

/**
 * Track saved in playlist
 */
export interface SavedTrack {
  encoded: string;
  title: string;
  author: string;
  uri: string;
  duration: number;
  artworkUrl?: string;
}

/**
 * Guild settings manager with SQLite persistence via Drizzle
 */
export class GuildSettingsManager {
  // In-memory cache for performance
  private readonly settingsCache = new Map<string, GuildMusicSettings>();

  /**
   * Get settings for a guild
   */
  get(guildId: string): GuildMusicSettings {
    // Check cache first
    const cached = this.settingsCache.get(guildId);
    if (cached) return cached;

    // Query database
    const row = db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).get();

    if (row) {
      const settings = this.rowToSettings(row);
      this.settingsCache.set(guildId, settings);
      return settings;
    }

    // Create defaults if not exists
    const defaults = this.createDefaults(guildId);
    this.saveSettings(defaults);
    this.settingsCache.set(guildId, defaults);
    return defaults;
  }

  /**
   * Update settings for a guild
   */
  update(guildId: string, updates: Partial<Omit<GuildMusicSettings, "guildId">>): GuildMusicSettings {
    const current = this.get(guildId);
    const updated = { ...current, ...updates };

    db.update(guildSettings)
      .set({
        djRoleId: updated.djRoleId,
        djOnlyMode: updated.djOnlyMode,
        is247Mode: updated.twentyFourSevenMode,
        autoplay: updated.autoplayEnabled,
        voteSkipEnabled: updated.voteSkipEnabled,
        voteSkipThreshold: updated.voteSkipPercentage / 100,
        defaultVolume: updated.defaultVolume,
      })
      .where(eq(guildSettings.guildId, guildId))
      .run();

    this.settingsCache.set(guildId, updated);
    return updated;
  }

  /**
   * Save settings to database
   */
  private saveSettings(settings: GuildMusicSettings): void {
    db.insert(guildSettings)
      .values({
        guildId: settings.guildId,
        djRoleId: settings.djRoleId,
        djOnlyMode: settings.djOnlyMode,
        is247Mode: settings.twentyFourSevenMode,
        autoplay: settings.autoplayEnabled,
        voteSkipEnabled: settings.voteSkipEnabled,
        voteSkipThreshold: settings.voteSkipPercentage / 100,
        defaultVolume: settings.defaultVolume,
      })
      .run();
  }

  /**
   * Convert database row to settings object
   */
  private rowToSettings(row: GuildSettingsRow): GuildMusicSettings {
    return {
      guildId: row.guildId,
      djRoleId: row.djRoleId,
      djOnlyMode: row.djOnlyMode,
      twentyFourSevenMode: row.is247Mode,
      autoplayEnabled: row.autoplay,
      defaultVolume: row.defaultVolume,
      voteSkipEnabled: row.voteSkipEnabled,
      voteSkipPercentage: row.voteSkipThreshold * 100,
    };
  }

  /**
   * Create default settings
   */
  private createDefaults(guildId: string): GuildMusicSettings {
    return {
      guildId,
      djRoleId: null,
      djOnlyMode: false,
      twentyFourSevenMode: false,
      autoplayEnabled: false,
      defaultVolume: 100,
      voteSkipEnabled: false,
      voteSkipPercentage: 50,
    };
  }

  // ==================== Playlist Management ====================

  /**
   * Create a new playlist
   */
  createPlaylist(
    guildId: string,
    ownerId: string,
    ownerName: string,
    name: string,
    isPublic: boolean = false
  ): SavedPlaylist {
    const id = `${guildId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    db.insert(playlists)
      .values({
        id,
        guildId,
        ownerId,
        ownerName,
        name,
        isPublic,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return {
      id,
      name,
      guildId,
      ownerId,
      ownerName,
      tracks: [],
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
      isPublic,
    };
  }

  /**
   * Get a playlist by ID with tracks
   */
  getPlaylist(id: string): SavedPlaylist | undefined {
    const playlist = db.select().from(playlists).where(eq(playlists.id, id)).get();
    if (!playlist) return undefined;

    return this.playlistWithTracks(playlist);
  }

  /**
   * Get all playlists for a guild
   */
  getGuildPlaylists(guildId: string): SavedPlaylist[] {
    const rows = db.select().from(playlists).where(eq(playlists.guildId, guildId)).all();
    return rows.map((p) => this.playlistWithTracks(p));
  }

  /**
   * Get playlists owned by a user in a guild
   */
  getUserPlaylists(guildId: string, userId: string): SavedPlaylist[] {
    const rows = db
      .select()
      .from(playlists)
      .where(and(eq(playlists.guildId, guildId), eq(playlists.ownerId, userId)))
      .all();
    return rows.map((p) => this.playlistWithTracks(p));
  }

  /**
   * Get accessible playlists for a user (own + public)
   */
  getAccessiblePlaylists(guildId: string, userId: string): SavedPlaylist[] {
    const rows = db
      .select()
      .from(playlists)
      .where(
        and(
          eq(playlists.guildId, guildId),
          or(eq(playlists.ownerId, userId), eq(playlists.isPublic, true))
        )
      )
      .all();
    return rows.map((p) => this.playlistWithTracks(p));
  }

  /**
   * Add tracks to a playlist
   */
  addTracksToPlaylist(playlistId: string, tracks: SavedTrack[]): boolean {
    const playlist = db.select().from(playlists).where(eq(playlists.id, playlistId)).get();
    if (!playlist) return false;

    // Get current max position
    const lastTrack = db
      .select({ position: playlistTracks.position })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(playlistTracks.position)
      .limit(1)
      .get();

    let position = lastTrack ? lastTrack.position + 1 : 0;

    // Insert tracks
    for (const track of tracks) {
      db.insert(playlistTracks)
        .values({
          playlistId,
          position: position++,
          encoded: track.encoded,
          title: track.title,
          author: track.author,
          uri: track.uri,
          duration: track.duration,
          artworkUrl: track.artworkUrl ?? null,
        })
        .run();
    }

    // Update playlist timestamp
    db.update(playlists)
      .set({ updatedAt: new Date() })
      .where(eq(playlists.id, playlistId))
      .run();

    return true;
  }

  /**
   * Remove a track from a playlist by index
   */
  removeTrackFromPlaylist(playlistId: string, index: number): SavedTrack | null {
    // Get all tracks ordered by position
    const tracks = db
      .select()
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(playlistTracks.position)
      .all();

    if (index < 0 || index >= tracks.length) return null;

    const trackToRemove = tracks[index]!;

    // Delete the track
    db.delete(playlistTracks).where(eq(playlistTracks.id, trackToRemove.id)).run();

    // Update playlist timestamp
    db.update(playlists)
      .set({ updatedAt: new Date() })
      .where(eq(playlists.id, playlistId))
      .run();

    return {
      encoded: trackToRemove.encoded,
      title: trackToRemove.title,
      author: trackToRemove.author,
      uri: trackToRemove.uri,
      duration: trackToRemove.duration,
      artworkUrl: trackToRemove.artworkUrl ?? undefined,
    };
  }

  /**
   * Delete a playlist
   */
  deletePlaylist(playlistId: string): boolean {
    // Check if playlist exists first
    const exists = db.select({ id: playlists.id }).from(playlists).where(eq(playlists.id, playlistId)).get();
    if (!exists) return false;
    
    db.delete(playlists).where(eq(playlists.id, playlistId)).run();
    return true;
  }

  /**
   * Rename a playlist
   */
  renamePlaylist(playlistId: string, newName: string): boolean {
    // Check if playlist exists first
    const exists = db.select({ id: playlists.id }).from(playlists).where(eq(playlists.id, playlistId)).get();
    if (!exists) return false;
    
    db.update(playlists)
      .set({ name: newName, updatedAt: new Date() })
      .where(eq(playlists.id, playlistId))
      .run();
    return true;
  }

  /**
   * Get playlist by name in guild
   */
  getPlaylistByName(guildId: string, name: string): SavedPlaylist | undefined {
    // Case-insensitive search - SQLite LIKE is case-insensitive by default for ASCII
    const rows = db
      .select()
      .from(playlists)
      .where(eq(playlists.guildId, guildId))
      .all();

    const playlist = rows.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (!playlist) return undefined;

    return this.playlistWithTracks(playlist);
  }

  /**
   * Helper to load playlist with its tracks
   */
  private playlistWithTracks(playlist: Playlist): SavedPlaylist {
    const trackRows = db
      .select()
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlist.id))
      .orderBy(playlistTracks.position)
      .all();

    return {
      id: playlist.id,
      name: playlist.name,
      guildId: playlist.guildId,
      ownerId: playlist.ownerId,
      ownerName: playlist.ownerName,
      tracks: trackRows.map((t) => ({
        encoded: t.encoded,
        title: t.title,
        author: t.author,
        uri: t.uri,
        duration: t.duration,
        artworkUrl: t.artworkUrl ?? undefined,
      })),
      createdAt: playlist.createdAt.getTime(),
      updatedAt: playlist.updatedAt.getTime(),
      isPublic: playlist.isPublic,
    };
  }
}
