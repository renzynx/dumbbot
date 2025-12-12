/**
 * Music track information from Lavalink
 */
export interface Track {
  identifier: string;
  title: string;
  author: string;
  duration: number;
  uri: string;
  artworkUrl: string | null;
  sourceName: string;
  isStream: boolean;
  requestedBy?: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

/**
 * Guild music player settings
 */
export interface GuildSettings {
  defaultVolume: number;
  djOnlyMode: boolean;
  twentyFourSevenMode: boolean;
  autoplayEnabled: boolean;
  voteSkipEnabled: boolean;
  voteSkipPercentage: number;
}

/**
 * Loop mode options for the player
 */
export type LoopMode = "none" | "track" | "queue";

/**
 * Current state of the music player for a guild
 */
export interface PlayerState {
  guildId: string;
  playing: boolean;
  paused: boolean;
  volume: number;
  position: number;
  loop: LoopMode;
  current: Track | null;
  queue: Track[];
  settings: GuildSettings;
}

/**
 * Queue information response
 */
export interface QueueResponse {
  current: Track | null;
  queue: Track[];
  size: number;
  duration: number;
}

/**
 * Filter preset information
 */
export interface FilterPreset {
  id: string;
  name: string;
  description: string;
}

/**
 * Filter presets response
 */
export interface FilterPresetsResponse {
  presets: FilterPreset[];
}

/**
 * Apply filter response
 */
export interface ApplyFilterResponse {
  success: boolean;
  message: string;
  activeFilter: string;
}

/**
 * Clear filter response
 */
export interface ClearFilterResponse {
  success: boolean;
  message: string;
}
