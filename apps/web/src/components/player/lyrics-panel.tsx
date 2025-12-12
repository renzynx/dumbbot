"use client";

import { useRef, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { LyricsResult, ParsedLyricLine, Track } from "@/lib/api";
import { useLyrics, useCurrentLyricLine, useLyricsSearch } from "@/hooks/use-lyrics";
import { X, Music2, Mic2, AlertCircle, Search, ArrowLeft, Check } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

interface LyricsPanelProps {
  track: Track | null;
  position: number;
  isOpen: boolean;
  onClose: () => void;
  onSeek?: (position: number) => void;
}

export function LyricsPanel({
  track,
  position,
  isOpen,
  onClose,
  onSeek,
}: LyricsPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    lyrics,
    parsedLyrics,
    isLoading,
    hasSyncedLyrics,
    hasPlainLyrics,
    isInstrumental,
    setManualLyrics,
  } = useLyrics({
    trackName: track?.title ?? null,
    artistName: track?.author ?? null,
    duration: track?.duration,
    enabled: isOpen && !!track,
  });

  const { currentIndex } = useCurrentLyricLine(parsedLyrics, position);

  // Search results
  const {
    data: searchResults = [],
    isLoading: isSearching,
  } = useLyricsSearch(searchQuery, isSearchMode && searchQuery.length > 0);

  // Auto-scroll to current line
  useEffect(() => {
    if (activeLineRef.current && hasSyncedLyrics && !isSearchMode) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentIndex, hasSyncedLyrics, isSearchMode]);

  // Reset search when closing or changing tracks
  useEffect(() => {
    if (!isOpen) {
      setIsSearchMode(false);
      setSearchQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    setIsSearchMode(false);
    setSearchQuery("");
  }, [track?.identifier]);

  const handleSelectLyrics = (result: LyricsResult) => {
    setManualLyrics(result);
    setIsSearchMode(false);
    setSearchQuery("");
  };

  const handleOpenSearch = () => {
    setIsSearchMode(true);
    // Pre-fill search with track info
    if (track) {
      setSearchQuery(`${track.title} ${track.author}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Close button outside panel */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-full"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      <div
        className="relative w-full max-w-2xl h-[80vh] bg-gradient-to-b from-card to-background rounded-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
          {isSearchMode ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  setIsSearchMode(false);
                  setSearchQuery("");
                }}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for lyrics..."
                  className="pl-9"
                  autoFocus
                />
              </div>
            </>
          ) : (
            <>
              {track?.artworkUrl ? (
                <img
                  src={track.artworkUrl}
                  alt={track.title}
                  className="w-12 h-12 rounded object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-secondary flex items-center justify-center shrink-0">
                  <Music2 className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-foreground font-semibold truncate">
                  {track?.title ?? "No track"}
                </h2>
                <p className="text-muted-foreground text-sm truncate">
                  {track?.author ?? "Unknown artist"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handleOpenSearch}
                title="Search for lyrics"
              >
                <Search className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 overflow-y-auto" ref={scrollRef}>
          <div className="p-6 pb-24">
            {isSearchMode ? (
              // Search results
              isSearching ? (
                <LyricsLoadingSkeleton />
              ) : searchQuery.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                  <Search className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-xl text-muted-foreground">Search for lyrics</p>
                  <p className="text-sm text-muted-foreground/70 mt-2">
                    Enter a song title and artist to find lyrics
                  </p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                  <AlertCircle className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-xl text-muted-foreground">No results found</p>
                  <p className="text-sm text-muted-foreground/70 mt-2">
                    Try a different search term
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((result, index) => (
                    <SearchResultItem
                      key={`${result.id}-${index}`}
                      result={result}
                      isSelected={lyrics?.id === result.id}
                      onSelect={() => handleSelectLyrics(result)}
                    />
                  ))}
                </div>
              )
            ) : (
              // Lyrics display
              isLoading ? (
                <LyricsLoadingSkeleton />
              ) : isInstrumental ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                  <Mic2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-xl text-muted-foreground">Instrumental</p>
                  <p className="text-sm text-muted-foreground/70 mt-2">
                    This track has no lyrics
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={handleOpenSearch}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Search manually
                  </Button>
                </div>
              ) : hasSyncedLyrics ? (
                <SyncedLyrics
                  lyrics={parsedLyrics}
                  currentIndex={currentIndex}
                  activeLineRef={activeLineRef}
                  onSeek={onSeek}
                />
              ) : hasPlainLyrics ? (
                <PlainLyrics lyrics={lyrics?.plainLyrics ?? ""} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                  <AlertCircle className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-xl text-muted-foreground">No lyrics found</p>
                  <p className="text-sm text-muted-foreground/70 mt-2">
                    We couldn't find lyrics for this track
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={handleOpenSearch}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Search manually
                  </Button>
                </div>
              )
            )}
          </div>
        </ScrollArea>

        {/* Footer with sync indicator */}
        {hasSyncedLyrics && !isSearchMode && (
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background to-transparent pointer-events-none">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Synced lyrics</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SearchResultItemProps {
  result: LyricsResult;
  isSelected: boolean;
  onSelect: () => void;
}

function SearchResultItem({ result, isSelected, onSelect }: SearchResultItemProps) {
  const hasSynced = !!result.syncedLyrics;
  const hasPlain = !!result.plainLyrics;
  const duration = result.duration ? formatTime(result.duration * 1000) : null;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-colors",
        "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground truncate">{result.trackName}</p>
          <p className="text-sm text-muted-foreground truncate">{result.artistName}</p>
          <div className="flex items-center gap-2 mt-1">
            {hasSynced && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                Synced
              </span>
            )}
            {hasPlain && !hasSynced && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                Plain
              </span>
            )}
            {result.instrumental && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                Instrumental
              </span>
            )}
            {duration && (
              <span className="text-xs text-muted-foreground">{duration}</span>
            )}
          </div>
        </div>
        {isSelected && (
          <Check className="h-5 w-5 text-primary shrink-0 mt-1" />
        )}
      </div>
    </button>
  );
}

interface SyncedLyricsProps {
  lyrics: ParsedLyricLine[];
  currentIndex: number;
  activeLineRef: React.RefObject<HTMLDivElement | null>;
  onSeek?: (position: number) => void;
}

function SyncedLyrics({
  lyrics,
  currentIndex,
  activeLineRef,
  onSeek,
}: SyncedLyricsProps) {
  return (
    <div className="space-y-4">
      {lyrics.map((line, index) => {
        const isActive = index === currentIndex;
        const isPast = index < currentIndex;

        return (
          <div
            key={`${line.time}-${index}`}
            ref={isActive ? activeLineRef : null}
            className={cn(
              "text-2xl font-bold cursor-pointer transition-all duration-300",
              isActive
                ? "text-foreground scale-105 origin-left"
                : isPast
                  ? "text-muted-foreground/50"
                  : "text-muted-foreground hover:text-foreground/70"
            )}
            onClick={() => onSeek?.(line.time)}
          >
            {line.text}
          </div>
        );
      })}
    </div>
  );
}

interface PlainLyricsProps {
  lyrics: string;
}

function PlainLyrics({ lyrics }: PlainLyricsProps) {
  const lines = lyrics.split("\n").filter((line) => line.trim());

  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <p key={index} className="text-lg text-secondary-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

function LyricsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-8 bg-secondary"
          style={{ width: `${Math.random() * 40 + 50}%` }}
        />
      ))}
    </div>
  );
}
