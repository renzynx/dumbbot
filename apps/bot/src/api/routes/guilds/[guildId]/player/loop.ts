import { json, type RouteHandler } from "@/api/server";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { LoopMode } from "@/music/Queue";
import { broadcastPlayerUpdate } from "../helpers";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * PATCH /api/guilds/:guildId/player/loop
 * Set loop mode
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

  const body = await ctx.json<{ mode: "none" | "track" | "queue" }>();

  // Map string to LoopMode enum
  const modeMap: Record<string, LoopMode> = {
    none: LoopMode.None,
    track: LoopMode.Track,
    queue: LoopMode.Queue,
  };

  const loopMode = modeMap[body.mode];
  if (loopMode === undefined) {
    return json({ error: "Invalid loop mode (none, track, queue)" }, 400);
  }

  music.setLoopMode(guildId, loopMode);
  broadcastPlayerUpdate(ctx.server, music, guildId);

  return json({ success: true, loopMode: body.mode });
};
