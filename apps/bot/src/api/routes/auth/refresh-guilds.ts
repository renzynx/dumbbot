import { json, type RouteHandler } from "@/api/server";
import { requireAuth, fetchUserGuilds, filterCommonGuilds, getSessionToken } from "@/api/middleware/auth";
import {
  getSessionWithAccount,
  updateAccountGuilds,
  invalidateAccountGuilds,
} from "@/db/sessions";

export const middleware = [requireAuth];

/**
 * POST /api/auth/refresh-guilds
 * Force refresh the user's guild list from Discord
 * Bypasses the 5-minute cache
 */
export const POST: RouteHandler = async (ctx) => {
  const user = ctx.user!;
  const token = getSessionToken(ctx.req)!;

  // Get account
  const result = await getSessionWithAccount(token);
  if (!result) {
    return json({ error: "Session not found" }, 401);
  }

  const { account } = result;

  // Invalidate cache first to ensure we fetch fresh data
  await invalidateAccountGuilds(account.userId);

  // Fetch fresh guilds from Discord
  const allGuilds = await fetchUserGuilds(user.accessToken);

  if (!allGuilds) {
    return json({ error: "Failed to fetch guilds from Discord" }, 500);
  }

  // Filter to only common guilds (where bot is present)
  const botGuildIds = new Set(ctx.client.guilds.cache.keys());
  const commonGuilds = filterCommonGuilds(allGuilds, botGuildIds);

  // Update account with only common guilds
  await updateAccountGuilds(account.userId, commonGuilds);

  return json({
    success: true,
    guilds: commonGuilds.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      iconUrl: g.icon
        ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
        : null,
      owner: g.owner,
      permissions: g.permissions,
      hasBot: true, // Always true since we only store common guilds
    })),
  });
};
