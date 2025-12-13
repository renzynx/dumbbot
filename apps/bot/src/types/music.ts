import type { Track } from "@discordbot/lavalink";

export interface QueueTrack {
  track: Track;
  requester: string;
  requesterId: string;
}

export interface HistoryTrack extends QueueTrack {
  playedAt: number;
}

export enum LoopMode {
  None = "none",
  Track = "track",
  Queue = "queue",
}

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

export interface SavedTrack {
  encoded: string;
  title: string;
  author: string;
  uri: string;
  duration: number;
  artworkUrl?: string;
}

export interface MusicManagerOptions {
  nodes: Omit<import("@discordbot/lavalink").LavalinkNodeOptions, "userId">[];
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
 * Cached player state for a guild
 * This is kept in sync with Lavalink and provides fast access to player state
 */
export interface GuildPlayer {
  guildId: string;
  playing: boolean;
  paused: boolean;
  position: number;
  volume: number;
  loopMode: LoopMode;
  current: QueueTrack | null;
  queue: QueueTrack[];
  /** Timestamp when position was last synced from Lavalink */
  positionTimestamp: number;
}