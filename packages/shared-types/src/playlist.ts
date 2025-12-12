import type { Track } from "./player";

/**
 * User playlist metadata
 */
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  trackCount: number;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Playlist with full track list
 */
export interface PlaylistWithTracks extends Playlist {
  tracks: Track[];
}
