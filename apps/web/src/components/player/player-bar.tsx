"use client";

import { useState } from "react";
import { type Track } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LyricsPanel } from "./lyrics-panel";
import { FilterPanel } from "./filter-panel";

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  VolumeX,
  ListMusic,
  Mic2,
  MicVocal,
  SlidersHorizontal,
  MoreVertical,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

interface PlayerBarProps {
  guildId: string;
  track: Track | null;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  loop: "none" | "track" | "queue";
  position: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onSkip: () => void;
  onPrevious: () => void;
  onSeek: (position: number) => void;
  onVolumeChange: (volume: number) => void;
  onLoopChange: () => void;
  onShuffle: () => void;
  onQueueToggle: () => void;
  isQueueOpen: boolean;
}

export function PlayerBar({
  guildId,
  track,
  isPlaying,
  isPaused,
  volume,
  loop,
  position,
  duration,
  onPlay,
  onPause,
  onSkip,
  onPrevious,
  onSeek,
  onVolumeChange,
  onLoopChange,
  onShuffle,
  onQueueToggle,
  isQueueOpen,
}: PlayerBarProps) {
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const LoopIcon = loop === "track" ? Repeat1 : Repeat;
  const VolumeIcon = volume === 0 ? VolumeX : Volume2;
  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const disabled = !track;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[70px] md:h-[90px] bg-background border-t border-border px-2 md:px-4 flex items-center justify-between z-50">
      {/* Left - Track Info */}
      <div className="flex items-center gap-2 md:gap-3 flex-1 md:flex-none md:w-[30%] min-w-0 md:min-w-[180px]">
        {track ? (
          <>
            <div className="relative group shrink-0">
              {track.artworkUrl ? (
                <img
                  src={track.artworkUrl}
                  alt={track.title}
                  className="h-12 w-12 md:h-14 md:w-14 rounded object-cover"
                />
              ) : (
                <div className="h-12 w-12 md:h-14 md:w-14 rounded bg-secondary flex items-center justify-center">
                  <Mic2 className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 md:flex-initial">
              <p className="text-xs md:text-sm font-medium text-foreground truncate hover:underline cursor-pointer">
                {track.title}
              </p>
              <p className="text-xs text-muted-foreground truncate hover:underline cursor-pointer">
                {track.author}
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-12 w-12 md:h-14 md:w-14 rounded bg-secondary shrink-0" />
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">No track playing</p>
            </div>
          </div>
        )}
      </div>

      {/* Center - Controls (hidden on mobile, shown on md+) */}
      <div className="hidden md:flex flex-col items-center gap-1 w-[40%] max-w-[722px]">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onShuffle}
            disabled={disabled}
          >
            <Shuffle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onPrevious}
            disabled={disabled}
          >
            <SkipBack className="h-4 w-4 fill-current" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-primary text-primary-foreground rounded-full hover:scale-105 hover:bg-primary transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            onClick={isPaused || !isPlaying ? onPlay : onPause}
            disabled={disabled}
          >
            {isPaused || !isPlaying ? (
              <Play className="h-4 w-4 fill-current ml-0.5" />
            ) : (
              <Pause className="h-4 w-4 fill-current" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onSkip}
            disabled={disabled}
          >
            <SkipForward className="h-4 w-4 fill-current" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed",
              loop !== "none" ? "text-primary" : "text-muted-foreground"
            )}
            onClick={onLoopChange}
            disabled={disabled}
          >
            <LoopIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 w-full">
          <span className="text-xs text-muted-foreground w-10 text-right">
            {formatTime(position)}
          </span>
          <div className="flex-1 group">
            <Slider
              value={[progress]}
              max={100}
              step={0.1}
              disabled={disabled}
              onValueChange={([value]) => {
                if (duration > 0) {
                  onSeek((value / 100) * duration);
                }
              }}
              className={cn(
                "cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:opacity-0 group-hover:[&_[role=slider]]:opacity-100 [&_[role=slider]]:transition-opacity",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            />
          </div>
          <span className="text-xs text-muted-foreground w-10">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Mobile Controls - shown only on mobile */}
      <div className="flex md:hidden items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onPrevious}
          disabled={disabled}
        >
          <SkipBack className="h-5 w-5 fill-current" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-12 w-12 bg-primary text-primary-foreground rounded-full hover:scale-105 hover:bg-primary transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          onClick={isPaused || !isPlaying ? onPlay : onPause}
          disabled={disabled}
        >
          {isPaused || !isPlaying ? (
            <Play className="h-5 w-5 fill-current ml-0.5" />
          ) : (
            <Pause className="h-5 w-5 fill-current" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onSkip}
          disabled={disabled}
        >
          <SkipForward className="h-5 w-5 fill-current" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-10 w-10 hover:text-foreground",
            isQueueOpen ? "text-primary" : "text-muted-foreground"
          )}
          onClick={onQueueToggle}
        >
          <ListMusic className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground hover:text-foreground"
          onClick={() => setMobileDrawerOpen(true)}
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile Quick Actions Drawer */}
      <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-center">Player Controls</SheetTitle>
          </SheetHeader>
          
          {/* Track info in drawer */}
          {track && (
            <div className="flex items-center gap-3 mb-6 px-2">
              {track.artworkUrl ? (
                <img
                  src={track.artworkUrl}
                  alt={track.title}
                  className="h-16 w-16 rounded object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded bg-secondary flex items-center justify-center">
                  <Mic2 className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {track.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {track.author}
                </p>
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="px-2 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-10 text-right">
                {formatTime(position)}
              </span>
              <Slider
                value={[progress]}
                max={100}
                step={0.1}
                disabled={disabled}
                onValueChange={([value]) => {
                  if (duration > 0) {
                    onSeek((value / 100) * duration);
                  }
                }}
                className={cn(
                  "flex-1 cursor-pointer",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              />
              <span className="text-xs text-muted-foreground w-10">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Volume control */}
          <div className="px-2 mb-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => onVolumeChange(volume === 0 ? 50 : 0)}
              >
                <VolumeIcon className="h-5 w-5" />
              </Button>
              <Slider
                value={[volume]}
                max={100}
                step={1}
                onValueChange={([value]) => onVolumeChange(value)}
                className="flex-1 cursor-pointer"
              />
              <span className="text-xs text-muted-foreground w-8 text-right">
                {volume}%
              </span>
            </div>
          </div>

          {/* Action buttons grid */}
          <div className="grid grid-cols-4 gap-2 px-2 mb-4">
            <Button
              variant="outline"
              className={cn(
                "flex flex-col items-center gap-1 h-auto py-3",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={onShuffle}
              disabled={disabled}
            >
              <Shuffle className="h-5 w-5" />
              <span className="text-xs">Shuffle</span>
            </Button>
            <Button
              variant="outline"
              className={cn(
                "flex flex-col items-center gap-1 h-auto py-3",
                loop !== "none" && "border-primary text-primary",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={onLoopChange}
              disabled={disabled}
            >
              <LoopIcon className="h-5 w-5" />
              <span className="text-xs">
                {loop === "none" ? "Loop" : loop === "track" ? "Track" : "Queue"}
              </span>
            </Button>
            <Button
              variant="outline"
              className={cn(
                "flex flex-col items-center gap-1 h-auto py-3",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => {
                setMobileDrawerOpen(false);
                setLyricsOpen(true);
              }}
              disabled={disabled}
            >
              <MicVocal className="h-5 w-5" />
              <span className="text-xs">Lyrics</span>
            </Button>
            <Button
              variant="outline"
              className={cn(
                "flex flex-col items-center gap-1 h-auto py-3",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => {
                setMobileDrawerOpen(false);
                setFiltersOpen(true);
              }}
              disabled={disabled}
            >
              <SlidersHorizontal className="h-5 w-5" />
              <span className="text-xs">Filters</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Right - Volume & Actions (hidden on mobile) */}
      <div className="hidden md:flex items-center justify-end gap-2 w-[30%] min-w-[180px]">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 hover:text-foreground",
            isQueueOpen ? "text-primary" : "text-muted-foreground"
          )}
          onClick={onQueueToggle}
        >
          <ListMusic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed",
            lyricsOpen ? "text-primary" : "text-muted-foreground"
          )}
          onClick={() => setLyricsOpen(true)}
          title="Lyrics"
          disabled={disabled}
        >
          <MicVocal className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed",
            filtersOpen ? "text-primary" : "text-muted-foreground"
          )}
          onClick={() => setFiltersOpen(true)}
          title="Filters"
          disabled={disabled}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1 w-[125px]">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => onVolumeChange(volume === 0 ? 50 : 0)}
          >
            <VolumeIcon className="h-4 w-4" />
          </Button>
          <Slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={([value]) => onVolumeChange(value)}
            className="w-[93px] cursor-pointer"
          />
        </div>
      </div>

      {/* Lyrics Panel */}
      <LyricsPanel
        track={track}
        position={position}
        isOpen={lyricsOpen}
        onClose={() => setLyricsOpen(false)}
        onSeek={onSeek}
      />

      {/* Filter Panel */}
      <FilterPanel
        guildId={guildId}
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        disabled={disabled}
      />
    </div>
  );
}
