import { json, type RouteHandler } from "@/api/server";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { broadcastPlayerUpdate } from "../helpers";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * POST /api/guilds/:guildId/player/play
 * Play/resume playback
 */
export const POST: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  const node = music.getIdealNode();
  const player = node?.getPlayer(guildId);
  if (!player) {
    return json({ error: "No active player" }, 404);
  }

  await music.resume(guildId);
  broadcastPlayerUpdate(ctx.server, music, guildId);

  return json({ success: true });
};
