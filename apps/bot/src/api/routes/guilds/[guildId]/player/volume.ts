import { json, type RouteHandler } from "@/api/server";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { broadcastPlayerUpdate } from "../helpers";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * PATCH /api/guilds/:guildId/player/volume
 * Set volume
 */
export const PATCH: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  const body = await ctx.json<{ volume: number }>();

  if (typeof body.volume !== "number" || body.volume < 0 || body.volume > 200) {
    return json({ error: "Invalid volume (0-200)" }, 400);
  }

  await music.setVolume(guildId, body.volume);
  broadcastPlayerUpdate(ctx.server, music, guildId);

  return json({ success: true, volume: body.volume });
};
