"use client";

import { useState } from "react";
import { ListPlus, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Track, Playlist } from "@/lib/api";
import {
  useAddTrackToPlaylist,
  useCreatePlaylist,
  usePlaylists,
} from "@/hooks/use-playlists";

interface AddToPlaylistProps {
  guildId: string;
  track: Track;
  variant?: "icon" | "button" | "menu-item";
}

export function AddToPlaylist({
  guildId,
  track,
  variant = "icon",
}: AddToPlaylistProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const { data: playlists = [] } = usePlaylists(guildId);
  const addTrack = useAddTrackToPlaylist(guildId);
  const createPlaylist = useCreatePlaylist(guildId);

  const handleAddToPlaylist = (playlistId: string) => {
    addTrack.mutate({ playlistId, track });
    setIsOpen(false);
  };

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) return;

    createPlaylist.mutate(
      { name: newPlaylistName.trim() },
      {
        onSuccess: (data) => {
          if (data?.id) {
            addTrack.mutate({ playlistId: data.id, track });
          }
          setShowCreateDialog(false);
          setNewPlaylistName("");
        },
      },
    );
  };

  const isLoading = addTrack.isPending || createPlaylist.isPending;

  // Render as a submenu inside a parent dropdown
  if (variant === "menu-item") {
    return (
      <>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-popover-foreground focus:text-accent-foreground focus:bg-accent">
            <ListPlus className="h-4 w-4 mr-2" />
            Add to Playlist
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48 bg-popover border-border">
            {playlists.length === 0 ? (
              <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                No playlists yet
              </div>
            ) : (
              playlists.map((playlist: Playlist) => (
                <DropdownMenuItem
                  key={playlist.id}
                  onClick={() => handleAddToPlaylist(playlist.id)}
                  disabled={isLoading}
                  className="text-popover-foreground focus:text-accent-foreground focus:bg-accent"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  <span className="truncate">{playlist.name}</span>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setShowCreateDialog(true);
              }}
              className="text-popover-foreground focus:text-accent-foreground focus:bg-accent"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create new playlist
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Playlist</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Playlist name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateAndAdd();
                  }
                }}
                autoFocus
              />
              <p className="mt-2 text-sm text-muted-foreground">
                &quot;{track.title}&quot; will be added to this playlist.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateAndAdd}
                disabled={!newPlaylistName.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create & Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Render as standalone dropdown
  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          {variant === "icon" ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Add to playlist"
            >
              <ListPlus className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <ListPlus className="mr-2 h-4 w-4" />
              Add to Playlist
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {playlists.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              No playlists yet
            </div>
          ) : (
            playlists.map((playlist: Playlist) => (
              <DropdownMenuItem
                key={playlist.id}
                onClick={() => handleAddToPlaylist(playlist.id)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                <span className="truncate">{playlist.name}</span>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setIsOpen(false);
              setShowCreateDialog(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create new playlist
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Playlist</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateAndAdd();
                }
              }}
              autoFocus
            />
            <p className="mt-2 text-sm text-muted-foreground">
              &quot;{track.title}&quot; will be added to this playlist.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAndAdd}
              disabled={!newPlaylistName.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create & Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
