/**
 * Lyrics search result from lrclib.net
 */
export interface LyricsResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

/**
 * Parsed synced lyric line with timestamp
 */
export interface ParsedLyricLine {
  time: number; // in milliseconds
  text: string;
}

/**
 * Search suggestion for autocomplete
 */
export interface SearchSuggestion {
  query: string;
  type: "suggestion" | "history";
}
