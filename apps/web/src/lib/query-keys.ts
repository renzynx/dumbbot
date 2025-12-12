/**
 * Query keys for React Query
 * Shared between server and client components
 */

export const authKeys = {
  all: ["auth"] as const,
  user: () => [...authKeys.all, "user"] as const,
};

export const playlistKeys = {
  all: ["playlists"] as const,
  list: (guildId: string) => [...playlistKeys.all, "list", guildId] as const,
  detail: (guildId: string, playlistId: string) =>
    [...playlistKeys.all, "detail", guildId, playlistId] as const,
};
