"use client";

import { type Track } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Music, X, Trash2 } from "lucide-react";

interface QueueProps {
  tracks: Track[];
  isLoading?: boolean;
  onRemove: (position: number) => void;
  onClear: () => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function QueueItem({
  track,
  position,
  onRemove,
}: {
  track: Track;
  position: number;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-md p-2 hover:bg-accent">
      <span className="w-6 text-center text-sm text-muted-foreground">
        {position + 1}
      </span>
      {track.artworkUrl ? (
        <img
          src={track.artworkUrl}
          alt={track.title}
          className="h-10 w-10 rounded object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
          <Music className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{track.title}</p>
        <p className="truncate text-xs text-muted-foreground">{track.author}</p>
      </div>
      <span className="text-xs text-muted-foreground">
        {formatDuration(track.duration)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100"
        onClick={onRemove}
        title="Remove from queue"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2">
      <Skeleton className="h-4 w-6" />
      <Skeleton className="h-10 w-10 rounded" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  );
}

export function Queue({ tracks, isLoading, onRemove, onClear }: QueueProps) {
  const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <QueueSkeleton key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-lg">Queue</CardTitle>
          <p className="text-sm text-muted-foreground">
            {tracks.length} track{tracks.length !== 1 ? "s" : ""} •{" "}
            {formatDuration(totalDuration)}
          </p>
        </div>
        {tracks.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Music className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Queue is empty</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-1">
              {tracks.map((track, index) => (
                <QueueItem
                  key={`${track.identifier}-${index}`}
                  track={track}
                  position={index}
                  onRemove={() => onRemove(index)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
