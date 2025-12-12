import { json, type RouteHandler } from "@/api/server";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { broadcastPlayerUpdate } from "@/api/routes/guilds/[guildId]/helpers";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * PATCH /api/guilds/:guildId/queue/move
 * Move a track in the queue
 * Expects 0-based indices: { from: number, to: number }
 */
export const PATCH: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  const queue = music.queues.get(guildId);
  if (!queue) {
    return json({ error: "No active queue" }, 404);
  }

  const body = await ctx.json<{ from: number; to: number }>();

  if (typeof body.from !== "number" || typeof body.to !== "number") {
    return json({ error: "Invalid request body" }, 400);
  }

  const success = queue.move(body.from, body.to);
  if (!success) {
    return json({ error: "Invalid positions" }, 400);
  }

  broadcastPlayerUpdate(ctx.server, music, guildId);

  return json({ success: true });
};
