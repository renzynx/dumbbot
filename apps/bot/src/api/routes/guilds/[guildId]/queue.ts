import { json, type RouteHandler } from "@/api/server";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { formatTrack, broadcastPlayerUpdate, ensureVoiceConnection } from "./helpers";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * GET /api/guilds/:guildId/queue
 * Get current queue
 */
export const GET: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  const queue = music.queues.get(guildId);
  if (!queue) {
    return json({ queue: [], total: 0 });
  }

  return json({
    queue: queue.tracks.map((t) => formatTrack(t)),
    total: queue.size,
  });
};

/**
 * POST /api/guilds/:guildId/queue
 * Add a track to the queue
 */
export const POST: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const music = ctx.client.music;
  const userId = ctx.user?.id;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  if (!userId) {
    return json({ error: "User not authenticated" }, 401);
  }

  const body = await ctx.json<{ query: string; userId?: string; username?: string }>();

  if (!body.query) {
    return json({ error: "Query is required" }, 400);
  }

  // Ensure bot is connected to the user's voice channel
  const voiceError = await ensureVoiceConnection(music, ctx.client, guildId, userId);
  if (voiceError) {
    return json({ error: voiceError }, 400);
  }

  // Search for tracks
  const result = await music.search(body.query);

  if (result.loadType === "error" || result.loadType === "empty") {
    return json({ error: "No results found" }, 404);
  }

  const queue = music.getQueue(guildId);
  const username = body.username ?? ctx.user?.username ?? "Web User";
  const requesterId = body.userId ?? userId;

  let added = 0;
  if (result.loadType === "playlist" && result.data.tracks) {
    for (const track of result.data.tracks) {
      queue.add(track, username, requesterId);
      added++;
    }
  } else if (result.loadType === "search" || result.loadType === "track") {
    const tracks = result.loadType === "search" ? result.data : [result.data];
    if (tracks.length > 0) {
      queue.add(tracks[0]!, username, requesterId);
      added = 1;
    }
  }

  // Start playing if nothing is playing
  if (!queue.current && queue.size > 0) {
    const next = queue.next();
    if (next) {
      await music.playTrack(guildId, next);
    }
  }

  broadcastPlayerUpdate(ctx.server, music, guildId);

  return json({ success: true, added });
};

/**
 * DELETE /api/guilds/:guildId/queue
 * Clear the queue
 */
export const DELETE: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  const queue = music.queues.get(guildId);
  if (!queue) {
    return json({ error: "No active queue" }, 404);
  }

  queue.clear();
  broadcastPlayerUpdate(ctx.server, music, guildId);

  return json({ success: true });
};
