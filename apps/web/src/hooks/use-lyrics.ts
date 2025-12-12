"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  lyricsApi,
  parseSyncedLyrics,
  type LyricsResult,
  type ParsedLyricLine,
} from "@/lib/api";

interface UseLyricsOptions {
  trackName: string | null;
  artistName: string | null;
  duration?: number;
  enabled?: boolean;
}

interface UseLyricsReturn {
  lyrics: LyricsResult | null;
  parsedLyrics: ParsedLyricLine[];
  isLoading: boolean;
  error: Error | null;
  hasSyncedLyrics: boolean;
  hasPlainLyrics: boolean;
  isInstrumental: boolean;
  refetch: () => void;
  setManualLyrics: (lyrics: LyricsResult) => void;
}

export function useLyrics({
  trackName,
  artistName,
  duration,
  enabled = true,
}: UseLyricsOptions): UseLyricsReturn {
  const queryEnabled = enabled && !!trackName && !!artistName;

  const {
    data: lyrics,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["lyrics", trackName, artistName],
    queryFn: async () => {
      if (!trackName || !artistName) return null;
      
      // Clean up track name - remove common suffixes like "(Official Video)", etc.
      const cleanTrackName = trackName
        .replace(/\s*\(.*?(official|video|audio|lyrics|hd|hq|4k|visualizer|music).*?\)/gi, "")
        .replace(/\s*\[.*?(official|video|audio|lyrics|hd|hq|4k|visualizer|music).*?\]/gi, "")
        .replace(/\s*-\s*(official|video|audio|lyrics).*$/gi, "")
        .trim();

      // Clean up artist name - remove "VEVO", "- Topic", etc.
      const cleanArtistName = artistName
        .replace(/\s*VEVO$/i, "")
        .replace(/\s*-\s*Topic$/i, "")
        .trim();

      // Try with duration first for better matching
      let result = await lyricsApi.search(cleanTrackName, cleanArtistName, duration);
      
      // If no result, try without duration
      if (!result) {
        result = await lyricsApi.search(cleanTrackName, cleanArtistName);
      }

      // If still no result, try searching with just the track name
      if (!result) {
        const searchResults = await lyricsApi.searchAll(`${cleanTrackName} ${cleanArtistName}`);
        if (searchResults.length > 0) {
          result = searchResults[0];
        }
      }

      return result;
    },
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
    retry: 1,
  });

  // Allow manual override of lyrics from search
  const [manualLyrics, setManualLyrics] = useState<LyricsResult | null>(null);

  // Reset manual lyrics when track changes
  useEffect(() => {
    setManualLyrics(null);
  }, [trackName, artistName]);

  const activeLyrics = manualLyrics ?? lyrics ?? null;
  const activeParsedLyrics = useMemo(() => {
    if (!activeLyrics?.syncedLyrics) return [];
    return parseSyncedLyrics(activeLyrics.syncedLyrics);
  }, [activeLyrics?.syncedLyrics]);

  return {
    lyrics: activeLyrics,
    parsedLyrics: activeParsedLyrics,
    isLoading,
    error: error as Error | null,
    hasSyncedLyrics: !!activeLyrics?.syncedLyrics,
    hasPlainLyrics: !!activeLyrics?.plainLyrics,
    isInstrumental: activeLyrics?.instrumental ?? false,
    refetch,
    setManualLyrics,
  };
}

/**
 * Hook to get the current lyric line based on playback position
 */
export function useCurrentLyricLine(
  parsedLyrics: ParsedLyricLine[],
  position: number
): { currentLine: ParsedLyricLine | null; currentIndex: number } {
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    if (parsedLyrics.length === 0) {
      setCurrentIndex(-1);
      return;
    }

    // Find the current line based on position
    let newIndex = -1;
    for (let i = parsedLyrics.length - 1; i >= 0; i--) {
      if (position >= parsedLyrics[i].time) {
        newIndex = i;
        break;
      }
    }

    setCurrentIndex(newIndex);
  }, [parsedLyrics, position]);

  const currentLine = currentIndex >= 0 ? parsedLyrics[currentIndex] : null;

  return { currentLine, currentIndex };
}

/**
 * Hook to search for lyrics
 */
export function useLyricsSearch(query: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["lyrics-search", query],
    queryFn: async () => {
      if (!query.trim()) return [];
      return lyricsApi.searchAll(query);
    },
    enabled: enabled && query.trim().length > 0,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
