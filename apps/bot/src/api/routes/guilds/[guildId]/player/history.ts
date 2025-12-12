import { json, type RouteHandler } from "@/api/server";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { formatHistoryTrack } from "../helpers";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * GET /api/guilds/:guildId/player/history
 * Get queue history
 */
export const GET: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  const queue = music.queues.get(guildId);
  if (!queue) {
    return json({ history: [] });
  }

  return json({
    history: queue.getHistory().map((h) => formatHistoryTrack(h)),
  });
};
