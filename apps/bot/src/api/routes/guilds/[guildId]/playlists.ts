import { json, type RouteHandler } from "@/api/server";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { db } from "@/db";
import { playlists, playlistTracks } from "@/db/schema";
import { eq, and, or, count, sum } from "drizzle-orm";
import { randomUUID } from "crypto";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * GET /api/guilds/:guildId/playlists
 * Get all playlists for a guild (user's own + public)
 */
export const GET: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const userId = ctx.user!.id;

  // Get playlists that are either owned by the user or are public
  const result = await db
    .select({
      id: playlists.id,
      name: playlists.name,
      ownerId: playlists.ownerId,
      ownerName: playlists.ownerName,
      isPublic: playlists.isPublic,
      createdAt: playlists.createdAt,
      updatedAt: playlists.updatedAt,
      trackCount: count(playlistTracks.id),
      duration: sum(playlistTracks.duration),
    })
    .from(playlists)
    .leftJoin(playlistTracks, eq(playlistTracks.playlistId, playlists.id))
    .where(
      and(
        eq(playlists.guildId, guildId),
        or(eq(playlists.ownerId, userId), eq(playlists.isPublic, true))
      )
    )
    .groupBy(playlists.id)
    .orderBy(playlists.updatedAt);

  return json({
    playlists: result.map((p) => ({
      id: p.id,
      name: p.name,
      ownerId: p.ownerId,
      ownerName: p.ownerName,
      isPublic: p.isPublic,
      trackCount: p.trackCount,
      duration: Number(p.duration) || 0,
      createdAt: p.createdAt?.toISOString(),
      updatedAt: p.updatedAt?.toISOString(),
    })),
  });
};

/**
 * POST /api/guilds/:guildId/playlists
 * Create a new playlist
 */
export const POST: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const user = ctx.user!;

  const body = await ctx.json<{ name: string; description?: string; isPublic?: boolean }>();

  if (!body.name?.trim()) {
    return json({ error: "Playlist name is required" }, 400);
  }

  const id = randomUUID();
  const now = new Date();

  await db.insert(playlists).values({
    id,
    guildId,
    ownerId: user.id,
    ownerName: user.username,
    name: body.name.trim(),
    isPublic: body.isPublic ?? false,
    createdAt: now,
    updatedAt: now,
  });

  return json({
    success: true,
    playlist: {
      id,
      name: body.name.trim(),
      ownerId: user.id,
      ownerName: user.username,
      isPublic: body.isPublic ?? false,
      trackCount: 0,
      duration: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  });
};
