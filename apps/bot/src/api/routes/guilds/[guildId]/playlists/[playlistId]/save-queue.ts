import { json, type RouteHandler } from "@/api/server";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { db } from "@/db";
import { playlists, playlistTracks } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * POST /api/guilds/:guildId/playlists/:playlistId/save-queue
 * Save the current queue to an existing playlist (replaces existing tracks)
 */
export const POST: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const playlistId = ctx.params.playlistId!;
  const userId = ctx.user!.id;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  // Check if playlist exists and is owned by user
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(
      and(
        eq(playlists.id, playlistId),
        eq(playlists.guildId, guildId),
        eq(playlists.ownerId, userId)
      )
    )
    .limit(1);

  if (!playlist) {
    return json({ error: "Playlist not found or you don't have permission to modify it" }, 404);
  }

  // Get current queue
  const queue = music.queues.get(guildId);
  if (!queue) {
    return json({ error: "No active queue" }, 400);
  }

  // Get all tracks (current + queued)
  const allTracks = [];
  if (queue.current) {
    allTracks.push(queue.current);
  }
  allTracks.push(...queue.tracks);

  if (allTracks.length === 0) {
    return json({ error: "Queue is empty" }, 400);
  }

  // Delete existing tracks
  await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, playlistId));

  // Insert new tracks
  const trackValues = allTracks.map((t, index) => ({
    playlistId,
    position: index,
    encoded: t.track.encoded,
    title: t.track.info.title,
    author: t.track.info.author,
    uri: t.track.info.uri ?? "",
    duration: t.track.info.length,
    artworkUrl: t.track.info.artworkUrl ?? null,
  }));

  await db.insert(playlistTracks).values(trackValues);

  // Update playlist timestamp
  await db
    .update(playlists)
    .set({ updatedAt: new Date() })
    .where(eq(playlists.id, playlistId));

  return json({
    success: true,
    message: `Saved ${allTracks.length} tracks to "${playlist.name}"`,
    trackCount: allTracks.length,
  });
};
