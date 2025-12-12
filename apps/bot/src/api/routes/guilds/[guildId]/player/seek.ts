import { json, type RouteHandler } from "@/api/server";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { broadcastPlayerUpdate } from "../helpers";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * POST /api/guilds/:guildId/player/seek
 * Seek to position in current track
 */
export const POST: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  const body = await ctx.json<{ position: number }>();

  if (typeof body.position !== "number") {
    return json({ error: "Invalid position" }, 400);
  }

  await music.seek(guildId, body.position);
  broadcastPlayerUpdate(ctx.server, music, guildId);

  return json({ success: true });
};
