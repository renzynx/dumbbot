"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Home,
  Library,
  ListMusic,
  Music2,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import type { Playlist, Track } from "@/lib/api";
import { buildDiscordGuildIconUrl, cn } from "@/lib/utils";
import { CreatePlaylistDialog } from "./create-playlist-dialog";

interface SidebarProps {
  guildId: string;
  queue: Track[];
  playlists: Playlist[];
  isLoadingPlaylists?: boolean;
  onRemoveFromQueue: (position: number) => void;
  onClearQueue: () => void;
  onMoveTrack: (from: number, to: number) => void;
  onLoadPlaylist: (playlistId: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onCreatePlaylist: (name: string) => void;
  isCreatingPlaylist?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

type ActiveSection = "queue" | "playlists";

export function Sidebar({
  queue,
  guildId,
  playlists,
  isLoadingPlaylists = false,
  onRemoveFromQueue,
  onClearQueue,
  onMoveTrack,
  onLoadPlaylist,
  onDeletePlaylist,
  onCreatePlaylist,
  isCreatingPlaylist = false,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<ActiveSection>("queue");

  if (!user?.guilds) {
    return null;
  }

  const guild = user.guilds.find((g) => g.id === guildId);

  if (!guild) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div className="flex h-full w-[72px] flex-col gap-2 bg-background shrink-0">
        <div className="rounded-lg bg-card border border-border p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-12 text-muted-foreground hover:text-foreground"
                onClick={onToggleCollapse}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-12 text-muted-foreground hover:text-foreground"
                asChild
              >
                <Link href="/dashboard">
                  <Home className="h-6 w-6" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Home</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex-1 rounded-lg bg-card border border-border p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-12 text-muted-foreground hover:text-foreground"
              >
                <Library className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Library</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-[300px] flex-col gap-2 bg-background shrink-0">
      {/* Top navigation */}
      <div className="rounded-lg bg-card border border-border p-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={
                  guild.icon
                    ? buildDiscordGuildIconUrl({
                        guildId: guild.id,
                        icon: guild.icon,
                      })
                    : undefined
                }
                alt={guild.name}
              />
              <AvatarFallback className="bg-secondary text-xs">
                {guild.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold text-foreground truncate max-w-[150px]">
              {guild.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onToggleCollapse}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        <nav className="space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-4 text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/dashboard">
              <Home className="h-5 w-5" />
              <span className="font-semibold">Home</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-4 text-muted-foreground hover:text-foreground"
          >
            <Search className="h-5 w-5" />
            <span className="font-semibold">Search</span>
          </Button>
        </nav>
      </div>

      {/* Library / Queue section */}
      <div className="flex-1 rounded-lg bg-card border border-border flex flex-col min-h-0 overflow-hidden">
        {/* Section tabs */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-2 text-muted-foreground hover:text-foreground h-8 px-3",
                activeSection === "queue" && "text-foreground bg-secondary",
              )}
              onClick={() => setActiveSection("queue")}
            >
              <ListMusic className="h-4 w-4" />
              <span className="text-sm font-medium">Queue</span>
              {queue.length > 0 && (
                <span className="text-xs text-muted-foreground">({queue.length})</span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-2 text-muted-foreground hover:text-foreground h-8 px-3",
                activeSection === "playlists" && "text-foreground bg-secondary",
              )}
              onClick={() => setActiveSection("playlists")}
            >
              <Library className="h-4 w-4" />
              <span className="text-sm font-medium">Playlists</span>
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {activeSection === "queue" && queue.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={onClearQueue}
                title="Clear queue"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {activeSection === "playlists" && (
              <CreatePlaylistDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Create playlist"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                }
                onCreatePlaylist={onCreatePlaylist}
                isPending={isCreatingPlaylist}
              />
            )}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 px-2">
          {activeSection === "queue" ? (
            <QueueList
              queue={queue}
              onRemoveFromQueue={onRemoveFromQueue}
              onMoveTrack={onMoveTrack}
            />
          ) : (
            <PlaylistList
              playlists={playlists}
              isLoading={isLoadingPlaylists}
              onLoadPlaylist={onLoadPlaylist}
              onDeletePlaylist={onDeletePlaylist}
            />
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

interface QueueListProps {
  queue: Track[];
  onRemoveFromQueue: (position: number) => void;
  onMoveTrack: (from: number, to: number) => void;
}

interface SortableQueueItemProps {
  track: Track;
  index: number;
  onRemove: (position: number) => void;
}

function SortableQueueItem({ track, index, onRemove }: SortableQueueItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${track.identifier}-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "group border-0 hover:bg-accent/50",
        isDragging && "bg-accent/80 opacity-90 z-50",
      )}
    >
      <TableCell className="w-8 p-1 pl-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex items-center justify-center"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </TableCell>
      <TableCell className="p-1">
        <div className="flex items-center gap-2">
          <div className="shrink-0 w-9 h-9 relative">
            {track.artworkUrl ? (
              <img
                src={track.artworkUrl}
                alt={track.title}
                className="w-full h-full object-cover rounded"
              />
            ) : (
              <div className="w-full h-full bg-secondary rounded flex items-center justify-center">
                <Music2 className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="text-sm text-foreground truncate">{track.title}</p>
            <p className="text-xs text-muted-foreground truncate">{track.author}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="w-8 p-1 pr-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function QueueList({ queue, onRemoveFromQueue, onMoveTrack }: QueueListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = queue.findIndex(
        (track, idx) => `${track.identifier}-${idx}` === active.id,
      );
      const newIndex = queue.findIndex(
        (track, idx) => `${track.identifier}-${idx}` === over.id,
      );

      if (oldIndex !== -1 && newIndex !== -1) {
        onMoveTrack(oldIndex, newIndex);
      }
    }
  };

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <Music2 className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">Queue is empty</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Add some tracks to get started
        </p>
      </div>
    );
  }

  const itemIds = queue.map((track, index) => `${track.identifier}-${index}`);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <Table className="table-fixed w-full">
          <TableBody>
            {queue.map((track, index) => (
              <SortableQueueItem
                key={`${track.identifier}-${index}`}
                track={track}
                index={index}
                onRemove={onRemoveFromQueue}
              />
            ))}
          </TableBody>
        </Table>
      </SortableContext>
    </DndContext>
  );
}

interface PlaylistListProps {
  playlists: Playlist[];
  isLoading: boolean;
  onLoadPlaylist: (playlistId: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
}

function PlaylistList({
  playlists,
  isLoading,
  onLoadPlaylist,
  onDeletePlaylist,
}: PlaylistListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="w-10 h-10 rounded bg-secondary" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4 bg-secondary" />
              <Skeleton className="h-3 w-1/2 bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <Library className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No playlists yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Create a playlist to save your favorite tracks
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 pb-4">
      {playlists.map((playlist) => (
        <div
          key={playlist.id}
          className="group flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer"
          onClick={() => onLoadPlaylist(playlist.id)}
        >
          <div className="flex-shrink-0 w-10 h-10 relative">
            {playlist.imageUrl ? (
              <img
                src={playlist.imageUrl}
                alt={playlist.name}
                className="w-full h-full object-cover rounded"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-secondary to-accent rounded flex items-center justify-center">
                <Music2 className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            {/* Play overlay on hover */}
            <div className="absolute inset-0 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Play className="h-4 w-4 text-foreground fill-foreground" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">{playlist.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {playlist.trackCount}{" "}
              {playlist.trackCount === 1 ? "track" : "tracks"}
            </p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDeletePlaylist(playlist.id);
              }}
              title="Delete playlist"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
