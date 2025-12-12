import { json, type RouteHandler } from "@/api/server";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { broadcastPlayerUpdate } from "../helpers";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * POST /api/guilds/:guildId/player/pause
 * Pause playback
 */
export const POST: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  await music.pause(guildId);
  broadcastPlayerUpdate(ctx.server, music, guildId);

  return json({ success: true });
};
