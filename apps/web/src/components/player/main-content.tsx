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
  ArrowDown,
  ArrowUp,
  Disc3,
  ExternalLink,
  GripVertical,
  MoreHorizontal,
  Music2,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/mode-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Track } from "@/lib/api";
import { cn, formatTime } from "@/lib/utils";
import { AddToPlaylist } from "./add-to-playlist";
import { SearchAutocomplete } from "./search-autocomplete";

interface MainContentProps {
  guildId: string;
  currentTrack: Track | null;
  queue: Track[];
  onAddTrack: (query: string) => void;
  isAddingTrack: boolean;
  onMoveTrack: (from: number, to: number) => void;
  onRemoveTrack: (index: number) => void;
  onPlayNext: (index: number) => void;
}

interface SortableUpNextItemProps {
  guildId: string;
  track: Track;
  index: number;
  queueLength: number;
  onRemove: () => void;
  onPlayNext: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SortableUpNextItem({
  guildId,
  track,
  index,
  queueLength,
  onRemove,
  onPlayNext,
  onMoveUp,
  onMoveDown,
}: SortableUpNextItemProps) {
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

  const isFirst = index === 0;
  const isLast = index === queueLength - 1;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "group border-0 hover:bg-accent/50",
        isDragging && "bg-accent/80 opacity-90 z-50",
      )}
    >
      <TableCell className="w-8 md:w-10 p-1 md:p-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex items-center justify-center"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </TableCell>
      <TableCell className="p-1 md:p-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="w-9 h-9 md:w-10 md:h-10 flex-shrink-0">
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
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-xs md:text-sm truncate">{track.title}</p>
            <p className="text-muted-foreground text-xs truncate">{track.author}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell w-24 p-2 text-right">
        <span className="text-muted-foreground text-sm">
          {formatTime(track.duration)}
        </span>
      </TableCell>
      <TableCell className="w-10 md:w-12 p-1 md:p-2 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 bg-popover border-border"
          >
            <AddToPlaylist guildId={guildId} track={track} variant="menu-item" />
            {!isFirst && (
              <DropdownMenuItem
                onClick={onPlayNext}
                className="text-popover-foreground focus:text-accent-foreground focus:bg-accent"
              >
                <Play className="h-4 w-4 mr-2" />
                Play Next
              </DropdownMenuItem>
            )}
            {!isFirst && (
              <DropdownMenuItem
                onClick={onMoveUp}
                className="text-popover-foreground focus:text-accent-foreground focus:bg-accent"
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Move Up
              </DropdownMenuItem>
            )}
            {!isLast && (
              <DropdownMenuItem
                onClick={onMoveDown}
                className="text-popover-foreground focus:text-accent-foreground focus:bg-accent"
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Move Down
              </DropdownMenuItem>
            )}
            {track.uri && (
              <DropdownMenuItem
                onClick={() => window.open(track.uri, "_blank")}
                className="text-popover-foreground focus:text-accent-foreground focus:bg-accent"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Source
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={onRemove}
              className="text-destructive focus:text-destructive focus:bg-accent"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from Queue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export function MainContent({
  guildId,
  currentTrack,
  queue,
  onAddTrack,
  isAddingTrack,
  onMoveTrack,
  onRemoveTrack,
  onPlayNext,
}: MainContentProps) {
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

  const itemIds = queue.map((track, index) => `${track.identifier}-${index}`);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-b from-secondary to-card border border-border rounded-lg overflow-hidden">
      {/* Header with search autocomplete */}
      <header className="shrink-0 z-10 p-2 md:p-4 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <SearchAutocomplete
            onSearch={onAddTrack}
            isLoading={isAddingTrack}
            placeholder="Search or paste a link..."
            className="flex-1 md:max-w-md"
          />
          <ModeToggle />
        </div>
      </header>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 md:p-6">
          {/* Now Playing Hero */}
          {currentTrack ? (
            <div className="mb-6 md:mb-8">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 md:gap-6 mb-4 md:mb-6">
                <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-56 md:h-56 flex-shrink-0 shadow-2xl mx-auto sm:mx-0">
                  {currentTrack.artworkUrl ? (
                    <img
                      src={currentTrack.artworkUrl}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-full bg-secondary rounded flex items-center justify-center">
                      <Disc3 className="h-12 w-12 sm:h-16 sm:w-16 md:h-24 md:w-24 text-muted-foreground/50 animate-spin-slow" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-end text-center sm:text-left">
                  <span className="text-xs font-medium text-foreground uppercase tracking-wider mb-1 md:mb-2">
                    Now Playing
                  </span>
                  <h1 className="text-xl sm:text-2xl md:text-5xl font-bold text-foreground mb-1 md:mb-2 line-clamp-2">
                    {currentTrack.title}
                  </h1>
                  <p className="text-secondary-foreground text-sm md:text-lg mb-2 md:mb-4">
                    {currentTrack.author}
                  </p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-xs md:text-sm text-muted-foreground flex-wrap">
                    {currentTrack.requestedBy && (
                      <>
                        <span>
                          Requested by {currentTrack.requestedBy.username}
                        </span>
                        <span className="hidden sm:inline">•</span>
                      </>
                    )}
                    <span>{formatTime(currentTrack.duration)}</span>
                    <span>•</span>
                    <span className="capitalize">
                      {currentTrack.sourceName}
                    </span>
                  </div>
                  <div className="mt-3 md:mt-4 flex justify-center sm:justify-start">
                    <AddToPlaylist guildId={guildId} track={currentTrack} variant="button" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 md:mb-8 py-8 md:py-16 text-center">
              <Music2 className="h-16 w-16 md:h-24 md:w-24 text-muted-foreground/50 mx-auto mb-3 md:mb-4" />
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
                Nothing is playing
              </h2>
              <p className="text-sm md:text-base text-muted-foreground">
                Search for a song or paste a link to get started
              </p>
            </div>
          )}

          {/* Queue Section */}
          {queue.length > 0 && (
            <div>
              <h2 className="text-lg md:text-xl font-bold text-foreground mb-3 md:mb-4">Up Next</h2>
              <div className="bg-card/50 rounded-lg overflow-hidden">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={itemIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="w-8 md:w-10 text-muted-foreground"></TableHead>
                          <TableHead className="text-muted-foreground text-xs md:text-sm">Title</TableHead>
                          <TableHead className="hidden sm:table-cell w-24 text-muted-foreground text-right text-xs md:text-sm">
                            Duration
                          </TableHead>
                          <TableHead className="w-10 md:w-12 text-muted-foreground text-right text-xs md:text-sm">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queue.map((track, index) => (
                          <SortableUpNextItem
                            key={`${track.identifier}-${index}`}
                            guildId={guildId}
                            track={track}
                            index={index}
                            queueLength={queue.length}
                            onRemove={() => onRemoveTrack(index)}
                            onPlayNext={() => onPlayNext(index)}
                            onMoveUp={() => onMoveTrack(index, index - 1)}
                            onMoveDown={() => onMoveTrack(index, index + 1)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
