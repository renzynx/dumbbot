"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MainContent, PlayerBar, Sidebar } from "@/components/player";
import { useAuth } from "@/hooks/use-auth";
import { skipToken, usePlayerSocket } from "@/hooks/use-player-socket";
import {
  useCreatePlaylist,
  useDeletePlaylist,
  useLoadPlaylist,
  usePlaylists,
} from "@/hooks/use-playlists";
import { useMediaQuery } from "@/hooks/use-media-query";

export function GuildDashboardContent({ guildId }: { guildId: string }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const wasConnectedRef = useRef(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const isReady = !isAuthLoading && isAuthenticated;

  const {
    state: playerState,
    interpolatedPosition,
    isConnected,
    error: wsError,
    isAddingTrack,
    actions,
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

  // Playlist hooks
  const { data: playlists = [], isLoading: isLoadingPlaylists } = usePlaylists(guildId);
  const loadPlaylist = useLoadPlaylist(guildId);
  const deletePlaylist = useDeletePlaylist(guildId);
  const createPlaylist = useCreatePlaylist(guildId);

  const handleDeletePlaylist = (playlistId: string) => {
    if (confirm("Are you sure you want to delete this playlist?")) {
      deletePlaylist.mutate(playlistId);
    }
  };

  // Handle queue toggle based on device
  const handleQueueToggle = () => {
    if (isMobile) {
      setMobileSidebarOpen(!mobileSidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden pb-[70px] md:pb-[90px]">
      {/* Main content area */}
      <div className="flex flex-1 min-h-0 gap-2 p-2 md:p-4 justify-center overflow-hidden">
        {/* Sidebar - hidden on mobile, shown via sheet */}
        <Sidebar
          guildId={guildId}
          queue={playerState?.queue ?? []}
          playlists={playlists}
          isLoadingPlaylists={isLoadingPlaylists}
          onRemoveFromQueue={actions.removeTrack}
          onClearQueue={actions.clearQueue}
          onMoveTrack={actions.moveTrack}
          onLoadPlaylist={(id) => loadPlaylist.mutate(id)}
          onDeletePlaylist={handleDeletePlaylist}
          onCreatePlaylist={(name) => createPlaylist.mutate({ name })}
          isCreatingPlaylist={createPlaylist.isPending}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          isMobile={isMobile}
          mobileOpen={mobileSidebarOpen}
          onMobileOpenChange={setMobileSidebarOpen}
        />

        {/* Main content */}
        <MainContent
          guildId={guildId}
          currentTrack={playerState?.current ?? null}
          queue={playerState?.queue ?? []}
          onAddTrack={actions.addTrack}
          isAddingTrack={isAddingTrack}
          onMoveTrack={actions.moveTrack}
          onRemoveTrack={actions.removeTrack}
          onPlayNext={actions.playNext}
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
        onPlay={actions.play}
        onPause={actions.pause}
        onSkip={actions.skip}
        onPrevious={() => {}} // TODO: implement previous track
        onSeek={actions.seek}
        onVolumeChange={actions.setVolume}
        onLoopChange={actions.toggleLoop}
        onShuffle={actions.shuffle}
        onQueueToggle={handleQueueToggle}
        isQueueOpen={isMobile ? mobileSidebarOpen : !sidebarCollapsed}
      />
    </div>
  );
}
