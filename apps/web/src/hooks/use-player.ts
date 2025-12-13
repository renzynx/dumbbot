"use client";

// Query keys (kept for cache invalidation compatibility if needed)
export const playerKeys = {
  all: ["player"] as const,
  state: (guildId: string) => [...playerKeys.all, "state", guildId] as const,
};

export const queueKeys = {
  all: ["queue"] as const,
  get: (guildId: string) => [...queueKeys.all, guildId] as const,
};
