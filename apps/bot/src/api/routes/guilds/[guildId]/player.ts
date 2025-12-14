import { json } from "@discordbot/api";
import type { RouteHandler } from "@/types/api";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { LoopMode } from "@/music/Queue";
import { formatTrack } from "./helpers";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * GET /api/guilds/:guildId/player
 * Get current player state and queue
 */
export const GET: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  const queue = music.queues.get(guildId);
  const node = music.getIdealNode();
  const player = node?.getPlayer(guildId);

  if (!queue) {
    return json({
      playing: false,
      current: null,
      queue: [],
      position: 0,
      volume: 100,
      loopMode: LoopMode.None,
      paused: false,
    });
  }

  return json({
    playing: !!queue.current,
    current: queue.current ? formatTrack(queue.current) : null,
    queue: queue.tracks.map((t) => formatTrack(t)),
    position: player?.state.position ?? 0,
    volume: queue.volume,
    loopMode: queue.loopMode,
    paused: player?.paused ?? false,
  });
};
