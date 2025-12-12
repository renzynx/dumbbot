import { json, type RouteHandler } from "@/api/server";
import { requireAuth, fetchUserGuilds, filterCommonGuilds } from "@/api/middleware/auth";
import { getSessionToken } from "@/api/middleware/auth";
import {
  getSessionWithAccount,
  getAccountGuilds,
  updateAccountGuilds,
} from "@/db/sessions";

export const middleware = [requireAuth];

/**
 * GET /api/auth/me
 * Get current authenticated user info with guilds
 */
export const GET: RouteHandler = async (ctx) => {
  const user = ctx.user!;
  const token = getSessionToken(ctx.req)!;

  // Get account to access cached guilds
  const result = await getSessionWithAccount(token);
  if (!result) {
    return json({ error: "Session not found" }, 401);
  }

  const { account } = result;

  // Try cached guilds first (already filtered to common guilds)
  let guilds = getAccountGuilds(account);

  // If no cached guilds or cache expired, fetch from Discord and filter
  if (!guilds) {
    const fetchedGuilds = await fetchUserGuilds(user.accessToken);
    if (fetchedGuilds) {
      // Filter to only common guilds (where bot is present)
      const botGuildIds = new Set(ctx.client.guilds.cache.keys());
      guilds = filterCommonGuilds(fetchedGuilds, botGuildIds);
      // Cache only common guilds (fire and forget)
      updateAccountGuilds(account.userId, guilds).catch(() => {});
    }
  }

  return json({
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    avatarUrl: user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/0.png`,
    guilds: guilds?.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      iconUrl: g.icon
        ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
        : null,
      owner: g.owner,
      permissions: g.permissions,
      hasBot: true,
    })) ?? [],
  });
};
