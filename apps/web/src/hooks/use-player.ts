"use client";

import { useMutation } from "@tanstack/react-query";
import { playerApi, queueApi } from "@/lib/api";
import { toast } from "sonner";

// Response type with optional message
interface ApiResponse {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

// Query keys (kept for cache invalidation compatibility)
export const playerKeys = {
  all: ["player"] as const,
  state: (guildId: string) => [...playerKeys.all, "state", guildId] as const,
};

export const queueKeys = {
  all: ["queue"] as const,
  get: (guildId: string) => [...queueKeys.all, guildId] as const,
};

/**
 * Hook to play/resume playback
 */
export function usePlay(guildId: string) {
  return useMutation({
    mutationFn: async (query?: string) => {
      const { data, error } = await playerApi.play(guildId, query);
      if (error) throw new Error(error.error);
      return data;
    },
    onError: (error: Error) => {
      toast.error("Failed to play", { description: error.message });
    },
  });
}

/**
 * Hook to pause playback
 */
export function usePause(guildId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await playerApi.pause(guildId);
      if (error) throw new Error(error.error);
      return data;
    },
    onError: (error: Error) => {
      toast.error("Failed to pause", { description: error.message });
    },
  });
}

/**
 * Hook to skip current track
 */
export function useSkip(guildId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await playerApi.skip(guildId);
      if (error) throw new Error(error.error);
      return data;
    },
    onError: (error: Error) => {
      toast.error("Failed to skip", { description: error.message });
    },
  });
}

/**
 * Hook to stop playback
 */
export function useStop(guildId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await playerApi.stop(guildId);
      if (error) throw new Error(error.error);
      return data;
    },
    onError: (error: Error) => {
      toast.error("Failed to stop", { description: error.message });
    },
  });
}

/**
 * Hook to seek in current track
 */
export function useSeek(guildId: string) {
  return useMutation({
    mutationFn: async (position: number) => {
      const { data, error } = await playerApi.seek(guildId, position);
      if (error) throw new Error(error.error);
      return data;
    },
    onError: (error: Error) => {
      toast.error("Failed to seek", { description: error.message });
    },
  });
}

/**
 * Hook to set volume
 */
export function useVolume(guildId: string) {
  return useMutation({
    mutationFn: async (volume: number) => {
      const { data, error } = await playerApi.setVolume(guildId, volume);
      if (error) throw new Error(error.error);
      return data;
    },
    onError: (error: Error) => {
      toast.error("Failed to set volume", { description: error.message });
    },
  });
}

/**
 * Hook to set loop mode
 */
export function useLoop(guildId: string) {
  return useMutation({
    mutationFn: async (mode: "none" | "track" | "queue") => {
      const { data, error } = await playerApi.setLoop(guildId, mode);
      if (error) throw new Error(error.error);
      return data;
    },
    onError: (error: Error) => {
      toast.error("Failed to set loop mode", { description: error.message });
    },
  });
}

/**
 * Hook to shuffle queue
 */
export function useShuffle(guildId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await playerApi.shuffle(guildId);
      if (error) throw new Error(error.error);
      return data as ApiResponse;
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? "Queue shuffled");
    },
    onError: (error: Error) => {
      toast.error("Failed to shuffle", { description: error.message });
    },
  });
}

/**
 * Hook to add track to queue
 */
export function useAddTrack(guildId: string) {
  return useMutation({
    mutationFn: async (query: string) => {
      const { data, error } = await queueApi.add(guildId, query);
      if (error) throw new Error(error.error);
      return data as ApiResponse;
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? "Track added to queue");
    },
    onError: (error: Error) => {
      toast.error("Failed to add track", { description: error.message });
    },
  });
}

/**
 * Hook to clear queue
 */
export function useClearQueue(guildId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await queueApi.clear(guildId);
      if (error) throw new Error(error.error);
      return data as ApiResponse;
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? "Queue cleared");
    },
    onError: (error: Error) => {
      toast.error("Failed to clear queue", { description: error.message });
    },
  });
}

/**
 * Hook to remove track from queue
 */
export function useRemoveTrack(guildId: string) {
  return useMutation({
    mutationFn: async (position: number) => {
      const { data, error } = await queueApi.remove(guildId, position);
      if (error) throw new Error(error.error);
      return data;
    },
    onError: (error: Error) => {
      toast.error("Failed to remove track", { description: error.message });
    },
  });
}

/**
 * Hook to move track in queue
 */
export function useMoveTrack(guildId: string) {
  return useMutation({
    mutationFn: async ({ from, to }: { from: number; to: number }) => {
      const { data, error } = await queueApi.move(guildId, from, to);
      if (error) throw new Error(error.error);
      return data;
    },
    onError: (error: Error) => {
      toast.error("Failed to move track", { description: error.message });
    },
  });
}
