"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

interface PlayerControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  loop: "none" | "track" | "queue";
  position: number;
  duration: number;
  disabled?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSkip: () => void;
  onStop: () => void;
  onSeek: (position: number) => void;
  onVolumeChange: (volume: number) => void;
  onLoopChange: (mode: "none" | "track" | "queue") => void;
  onShuffle: () => void;
}

export function PlayerControls({
  isPlaying,
  isPaused,
  volume,
  loop,
  position,
  duration,
  disabled,
  onPlay,
  onPause,
  onSkip,
  onStop,
  onSeek,
  onVolumeChange,
  onLoopChange,
  onShuffle,
}: PlayerControlsProps) {
  const cycleLoop = () => {
    // Cycle: track → queue → none → track
    const nextMode =
      loop === "track" ? "queue" : loop === "queue" ? "none" : "track";
    onLoopChange(nextMode);
  };

  const LoopIcon = loop === "track" ? Repeat1 : Repeat;
  const VolumeIcon = volume === 0 ? VolumeX : Volume2;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <Slider
          value={[position]}
          max={duration || 100}
          step={1000}
          disabled={disabled || !duration}
          onValueChange={([value]) => onSeek(value)}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={onShuffle}
          title="Shuffle queue"
        >
          <Shuffle className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={onStop}
          title="Stop"
        >
          <Square className="h-4 w-4" />
        </Button>

        <Button
          variant="default"
          size="icon"
          className="h-12 w-12"
          disabled={disabled}
          onClick={isPaused || !isPlaying ? onPlay : onPause}
          title={isPaused || !isPlaying ? "Play" : "Pause"}
        >
          {isPaused || !isPlaying ? (
            <Play className="h-5 w-5" />
          ) : (
            <Pause className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={onSkip}
          title="Skip"
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={cycleLoop}
          title={`Loop: ${loop}`}
          className={cn(loop !== "none" && "text-primary")}
        >
          <LoopIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Volume control */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => onVolumeChange(volume === 0 ? 50 : 0)}
          title={volume === 0 ? "Unmute" : "Mute"}
        >
          <VolumeIcon className="h-4 w-4" />
        </Button>
        <Slider
          value={[volume]}
          max={100}
          step={1}
          onValueChange={([value]) => onVolumeChange(value)}
          className="flex-1"
        />
        <span className="w-8 text-right text-xs text-muted-foreground">
          {volume}%
        </span>
      </div>
    </div>
  );
}
