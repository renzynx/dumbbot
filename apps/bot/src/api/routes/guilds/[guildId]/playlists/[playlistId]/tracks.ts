import { json, type RouteHandler } from "@/api/server";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { db } from "@/db";
import { playlists, playlistTracks } from "@/db/schema";
import { eq, and, max } from "drizzle-orm";

export const middleware = [requireAuth, requireGuildAccess];

interface AddTrackBody {
  track: {
    encoded: string;
    title: string;
    author: string;
    uri: string;
    duration: number;
    artworkUrl?: string;
  };
}

/**
 * POST /api/guilds/:guildId/playlists/:playlistId/tracks
 * Add a track to a playlist
 */
export const POST: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const playlistId = ctx.params.playlistId!;
  const userId = ctx.user!.id;

  const body = await ctx.json<AddTrackBody>();
  if (!body.track) {
    return json({ error: "Track data is required" }, 400);
  }

  const { track } = body;
  if (!track.encoded || !track.title || !track.uri) {
    return json({ error: "Track must have encoded, title, and uri" }, 400);
  }

  // Check if playlist exists and user owns it
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
    return json({ error: "Playlist not found or you don't own it" }, 404);
  }

  // Get max position in playlist
  const [result] = await db
    .select({ maxPos: max(playlistTracks.position) })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId));

  const nextPosition = (result?.maxPos ?? -1) + 1;

  // Insert the track
  await db.insert(playlistTracks).values({
    playlistId,
    position: nextPosition,
    encoded: track.encoded,
    title: track.title,
    author: track.author,
    uri: track.uri,
    duration: track.duration,
    artworkUrl: track.artworkUrl ?? null,
  });

  // Update playlist timestamp
  await db
    .update(playlists)
    .set({ updatedAt: new Date() })
    .where(eq(playlists.id, playlistId));

  return json({
    success: true,
    message: `Added "${track.title}" to playlist`,
    position: nextPosition,
  });
};
