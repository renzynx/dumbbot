import { json, type RouteHandler } from "@/api/server";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { formatTrack, broadcastPlayerUpdate } from "@/api/routes/guilds/[guildId]/helpers";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * DELETE /api/guilds/:guildId/queue/:position
 * Remove a track from queue
 * Expects 0-based index in URL
 */
export const DELETE: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const position = ctx.params.position!;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  const queue = music.queues.get(guildId);
  if (!queue) {
    return json({ error: "No active queue" }, 404);
  }

  const index = parseInt(position, 10);
  if (isNaN(index) || index < 0) {
    return json({ error: "Invalid position" }, 400);
  }

  const removed = queue.remove(index);

  if (!removed) {
    return json({ error: "Invalid position" }, 400);
  }

  broadcastPlayerUpdate(ctx.server, music, guildId);

  return json({ success: true, removed: formatTrack(removed) });
};
