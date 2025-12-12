"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MainContent, PlayerBar, Sidebar } from "@/components/player";
import { useAuth } from "@/hooks/use-auth";
import {
  useAddTrack,
  useClearQueue,
  useLoop,
  useMoveTrack,
  usePause,
  usePlay,
  useRemoveTrack,
  useSeek,
  useShuffle,
  useSkip,
  useVolume,
} from "@/hooks/use-player";
import { skipToken, usePlayerSocket } from "@/hooks/use-player-socket";
import {
  useCreatePlaylist,
  useDeletePlaylist,
  useLoadPlaylist,
  usePlaylists,
} from "@/hooks/use-playlists";

export function GuildDashboardContent({ guildId }: { guildId: string }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const wasConnectedRef = useRef(false);

  const isReady = !isAuthLoading && isAuthenticated;

  const {
    state: playerState,
    interpolatedPosition,
    isConnected,
    error: wsError,
    optimisticUpdate,
  } = usePlayerSocket(isReady ? guildId : skipToken);

  // Show toast for WebSocket connection changes
  useEffect(() => {
    if (isAuthLoading) return;

    if (isConnected && !wasConnectedRef.current) {
      if (wasConnectedRef.current === false && performance.now() > 5000) {
        toast.success("Reconnected to server");
      }
      wasConnectedRef.current = true;
    } else if (!isConnected && wasConnectedRef.current) {
      toast.error("Disconnected from server", {
        description: "Attempting to reconnect...",
      });
      wasConnectedRef.current = false;
    }
  }, [isConnected, isAuthLoading]);

  // Show toast for WebSocket errors
  useEffect(() => {
    if (wsError && !isAuthLoading) {
      toast.error("Connection error", { description: wsError });
    }
  }, [wsError, isAuthLoading]);

  // Mutations for player controls
  const play = usePlay(guildId);
  const pause = usePause(guildId);
  const skip = useSkip(guildId);
  const seek = useSeek(guildId);
  const volume = useVolume(guildId);
  const loop = useLoop(guildId);
  const shuffle = useShuffle(guildId);
  const addTrack = useAddTrack(guildId);
  const removeTrack = useRemoveTrack(guildId);
  const clearQueue = useClearQueue(guildId);
  const moveTrack = useMoveTrack(guildId);

  const { data: playlists = [], isLoading: isLoadingPlaylists } =
    usePlaylists(guildId);
  const loadPlaylist = useLoadPlaylist(guildId);
  const deletePlaylist = useDeletePlaylist(guildId);
  const createPlaylist = useCreatePlaylist(guildId);

  // Handlers with optimistic updates
  const handlePlay = () => {
    optimisticUpdate((prev) =>
      prev ? { ...prev, paused: false, playing: true } : prev,
    );
    play.mutate(undefined);
  };

  const handlePause = () => {
    optimisticUpdate((prev) => (prev ? { ...prev, paused: true } : prev));
    pause.mutate();
  };

  const handleSkip = () => {
    skip.mutate();
  };

  const handleSeek = (position: number) => {
    optimisticUpdate((prev) => (prev ? { ...prev, position } : prev));
    seek.mutate(position);
  };

  const handleVolumeChange = (vol: number) => {
    optimisticUpdate((prev) => (prev ? { ...prev, volume: vol } : prev));
    volume.mutate(vol);
  };

  const handleLoopChange = () => {
    // Cycle: track → queue → none → track
    const nextLoop =
      playerState?.loop === "track"
        ? "queue"
        : playerState?.loop === "queue"
          ? "none"
          : "track";
    optimisticUpdate((prev) => (prev ? { ...prev, loop: nextLoop } : prev));
    loop.mutate(nextLoop);
  };

  const handleShuffle = () => {
    shuffle.mutate();
  };

  const handleAddTrack = (query: string) => {
    addTrack.mutate(query);
  };

  const handleRemoveFromQueue = (position: number) => {
    optimisticUpdate((prev) => {
      if (!prev) return prev;
      const newQueue = [...prev.queue];
      newQueue.splice(position, 1);
      return { ...prev, queue: newQueue };
    });
    removeTrack.mutate(position);
  };

  const handleClearQueue = () => {
    optimisticUpdate((prev) => (prev ? { ...prev, queue: [] } : prev));
    clearQueue.mutate();
  };

  const handleMoveTrack = (from: number, to: number) => {
    optimisticUpdate((prev) => {
      if (!prev) return prev;
      const newQueue = [...prev.queue];
      const [removed] = newQueue.splice(from, 1);
      newQueue.splice(to, 0, removed);
      return { ...prev, queue: newQueue };
    });
    moveTrack.mutate({ from, to });
  };

  const handlePlayNext = (index: number) => {
    if (index > 0) {
      handleMoveTrack(index, 0);
    }
  };

  const handleLoadPlaylist = (playlistId: string) => {
    loadPlaylist.mutate(playlistId);
  };

  const handleDeletePlaylist = (playlistId: string) => {
    if (confirm("Are you sure you want to delete this playlist?")) {
      deletePlaylist.mutate(playlistId);
    }
  };

  const handleCreatePlaylist = (name: string) => {
    createPlaylist.mutate({ name });
  };

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden pb-[90px]">
      {/* Main content area */}
      <div className="flex flex-1 min-h-0 gap-2 p-4 justify-center overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          guildId={guildId}
          queue={playerState?.queue ?? []}
          playlists={playlists}
          isLoadingPlaylists={isLoadingPlaylists}
          onRemoveFromQueue={handleRemoveFromQueue}
          onClearQueue={handleClearQueue}
          onMoveTrack={handleMoveTrack}
          onLoadPlaylist={handleLoadPlaylist}
          onDeletePlaylist={handleDeletePlaylist}
          onCreatePlaylist={handleCreatePlaylist}
          isCreatingPlaylist={createPlaylist.isPending}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main content */}
        <MainContent
          currentTrack={playerState?.current ?? null}
          queue={playerState?.queue ?? []}
          onAddTrack={handleAddTrack}
          isAddingTrack={addTrack.isPending}
          onMoveTrack={handleMoveTrack}
          onRemoveTrack={handleRemoveFromQueue}
          onPlayNext={handlePlayNext}
        />
      </div>

      {/* Fixed bottom player bar */}
      <PlayerBar
        guildId={guildId}
        track={playerState?.current ?? null}
        isPlaying={playerState?.playing ?? false}
        isPaused={playerState?.paused ?? false}
        volume={playerState?.volume ?? 100}
        loop={playerState?.loop ?? "none"}
        position={interpolatedPosition}
        duration={playerState?.current?.duration ?? 0}
        onPlay={handlePlay}
        onPause={handlePause}
        onSkip={handleSkip}
        onPrevious={() => {}} // TODO: implement previous track
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onLoopChange={handleLoopChange}
        onShuffle={handleShuffle}
        onQueueToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        isQueueOpen={!sidebarCollapsed}
      />
    </div>
  );
}
