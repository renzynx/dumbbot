"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { playlistApi } from "@/lib/api";
import { playlistKeys } from "@/lib/query-keys";

export { playlistKeys } from "@/lib/query-keys";

export function usePlaylists(guildId: string) {
  return useSuspenseQuery({
    queryKey: playlistKeys.list(guildId),
    queryFn: async () => {
      const { data, error } = await playlistApi.getAll(guildId);
      if (error) throw new Error(error.error);
      return data?.playlists ?? [];
    },
  });
}

export function usePlaylist(guildId: string, playlistId: string | null) {
  return useQuery({
    queryKey: playlistKeys.detail(guildId, playlistId ?? ""),
    queryFn: async () => {
      if (!playlistId) return null;
      const { data, error } = await playlistApi.get(guildId, playlistId);
      if (error) throw new Error(error.error);
      return data;
    },
    enabled: !!playlistId,
  });
}

export function useCreatePlaylist(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      description,
    }: {
      name: string;
      description?: string;
    }) => {
      const { data, error } = await playlistApi.create(
        guildId,
        name,
        description,
      );
      if (error) throw new Error(error.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.list(guildId) });
      toast.success(`Playlist "${data?.name}" created`);
    },
    onError: (error: Error) => {
      toast.error("Failed to create playlist", { description: error.message });
    },
  });
}

export function useDeletePlaylist(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (playlistId: string) => {
      const { data, error } = await playlistApi.delete(guildId, playlistId);
      if (error) throw new Error(error.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playlistKeys.list(guildId) });
      toast.success("Playlist deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete playlist", { description: error.message });
    },
  });
}

export function useSaveQueueToPlaylist(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (playlistId: string) => {
      const { data, error } = await playlistApi.saveQueue(guildId, playlistId);
      if (error) throw new Error(error.error);
      return data;
    },
    onSuccess: (data, playlistId) => {
      queryClient.invalidateQueries({
        queryKey: playlistKeys.detail(guildId, playlistId),
      });
      queryClient.invalidateQueries({ queryKey: playlistKeys.list(guildId) });
      toast.success(data?.message ?? "Queue saved to playlist");
    },
    onError: (error: Error) => {
      toast.error("Failed to save queue", { description: error.message });
    },
  });
}

export function useLoadPlaylist(guildId: string) {
  return useMutation({
    mutationFn: async (playlistId: string) => {
      const { data, error } = await playlistApi.load(guildId, playlistId);
      if (error) throw new Error(error.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? "Playlist loaded to queue");
    },
    onError: (error: Error) => {
      toast.error("Failed to load playlist", { description: error.message });
    },
  });
}
