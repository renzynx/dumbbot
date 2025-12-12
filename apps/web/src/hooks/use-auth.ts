"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { authKeys } from "@/lib/query-keys";

export { authKeys } from "@/lib/query-keys";

/**
 * Main auth hook - provides user data and auth actions
 */
export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const {
    data: user,
    error,
    isLoading,
    refetch: refreshUser,
  } = useQuery({
    queryKey: authKeys.user(),
    queryFn: async () => {
      const { data, error } = await authApi.getMe();
      if (error) {
        if (error.status === 401) return null;
        throw new Error(error.error);
      }
      return data;
    },
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await authApi.logout();
      if (error) throw new Error(error.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
      router.push("/");
    },
  });

  const refreshGuildsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await authApi.refreshGuilds();
      if (error) throw new Error(error.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });

  return {
    user,
    guilds: user?.guilds ?? [],
    isAuthenticated: !!user,
    isLoading,
    error: error?.message ?? null,
    login: () => {
      router.push(authApi.getLoginUrl());
    },
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    refreshUser,
    refreshGuilds: refreshGuildsMutation.mutateAsync,
    isRefreshingGuilds: refreshGuildsMutation.isPending,
  };
}
