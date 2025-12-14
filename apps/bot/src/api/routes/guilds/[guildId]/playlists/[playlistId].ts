import { json } from "@discordbot/api";
import type { RouteHandler } from "@/types/api";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { db } from "@/db";
import { playlists, playlistTracks } from "@/db/schema";
import { eq, and, or, asc } from "drizzle-orm";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * GET /api/guilds/:guildId/playlists/:playlistId
 * Get a single playlist with all its tracks
 */
export const GET: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const playlistId = ctx.params.playlistId!;
  const userId = ctx.user!.id;

  // Get playlist (must be owned by user or public)
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(
      and(
        eq(playlists.id, playlistId),
        eq(playlists.guildId, guildId),
        or(eq(playlists.ownerId, userId), eq(playlists.isPublic, true))
      )
    )
    .limit(1);

  if (!playlist) {
    return json({ error: "Playlist not found" }, 404);
  }

  // Get all tracks for this playlist
  const tracks = await db
    .select()
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId))
    .orderBy(asc(playlistTracks.position));

  return json({
    playlist: {
      id: playlist.id,
      name: playlist.name,
      ownerId: playlist.ownerId,
      ownerName: playlist.ownerName,
      isPublic: playlist.isPublic,
      createdAt: playlist.createdAt?.toISOString(),
      updatedAt: playlist.updatedAt?.toISOString(),
      tracks: tracks.map((t) => ({
        title: t.title,
        author: t.author,
        uri: t.uri,
        duration: t.duration,
        artworkUrl: t.artworkUrl,
        encoded: t.encoded,
        position: t.position,
      })),
    },
  });
};

/**
 * DELETE /api/guilds/:guildId/playlists/:playlistId
 * Delete a playlist (only owner can delete)
 */
export const DELETE: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const playlistId = ctx.params.playlistId!;
  const userId = ctx.user!.id;

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
    return json({ error: "Playlist not found or you don't have permission to delete it" }, 404);
  }

  // Delete playlist (tracks will be cascaded)
  await db.delete(playlists).where(eq(playlists.id, playlistId));

  return json({ success: true });
};
