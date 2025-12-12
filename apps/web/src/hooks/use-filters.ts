"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { filtersApi } from "@/lib/api";
import { toast } from "sonner";

export const filterKeys = {
  all: ["filters"] as const,
  presets: (guildId: string) => [...filterKeys.all, "presets", guildId] as const,
};

/**
 * Hook to get available filter presets
 */
export function useFilterPresets(guildId: string) {
  return useQuery({
    queryKey: filterKeys.presets(guildId),
    queryFn: async () => {
      const { data, error } = await filtersApi.getPresets(guildId);
      if (error) throw new Error(error.error);
      return data?.presets ?? [];
    },
    staleTime: Infinity, // Presets don't change
  });
}

/**
 * Hook to apply a filter preset
 */
export function useApplyFilter(guildId: string) {
  return useMutation({
    mutationFn: async (preset: string) => {
      const { data, error } = await filtersApi.apply(guildId, preset);
      if (error) throw new Error(error.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? "Filter applied");
    },
    onError: (error: Error) => {
      toast.error("Failed to apply filter", { description: error.message });
    },
  });
}

/**
 * Hook to clear all filters
 */
export function useClearFilter(guildId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await filtersApi.clear(guildId);
      if (error) throw new Error(error.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? "Filters cleared");
    },
    onError: (error: Error) => {
      toast.error("Failed to clear filters", { description: error.message });
    },
  });
}
