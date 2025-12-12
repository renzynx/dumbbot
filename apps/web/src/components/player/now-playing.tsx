"use client";

import { type Track } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Music } from "lucide-react";

interface NowPlayingProps {
  track: Track | null;
  isLoading?: boolean;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function NowPlaying({ track, isLoading }: NowPlayingProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <Skeleton className="h-20 w-20 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!track) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Music className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Nothing playing</p>
            <p className="text-sm text-muted-foreground">
              Add a track to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        {track.artworkUrl ? (
          <img
            src={track.artworkUrl}
            alt={track.title}
            className="h-20 w-20 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-md bg-muted">
            <Music className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{track.title}</h3>
          <p className="truncate text-sm text-muted-foreground">{track.author}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDuration(track.duration)}</span>
            <span>•</span>
            <span className="capitalize">{track.sourceName}</span>
            {track.requestedBy && (
              <>
                <span>•</span>
                <span>Requested by {track.requestedBy.username}</span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
