import { json } from "@discordbot/api";
import type { RouteHandler } from "@/types/api";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { db } from "@/db";
import { playlists, playlistTracks } from "@/db/schema";
import { eq, and, or, asc } from "drizzle-orm";
import { broadcastPlayerUpdate, ensureVoiceConnection } from "@/api/routes/guilds/[guildId]/helpers";
import type { Track } from "@discordbot/lavalink";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * POST /api/guilds/:guildId/playlists/:playlistId/load
 * Load a playlist into the current queue
 */
export const POST: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const playlistId = ctx.params.playlistId!;
  const userId = ctx.user!.id;
  const user = ctx.user!;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

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
  const dbTracks = await db
    .select()
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId))
    .orderBy(asc(playlistTracks.position));

  if (dbTracks.length === 0) {
    return json({ error: "Playlist is empty" }, 400);
  }

  // Ensure bot is connected to the user's voice channel
  const voiceError = await ensureVoiceConnection(music, ctx.client, guildId, userId);
  if (voiceError) {
    return json({ error: voiceError }, 400);
  }

  // Convert db tracks to Lavalink Track format
  const lavalinkTracks: Track[] = dbTracks.map((t) => ({
    encoded: t.encoded,
    info: {
      title: t.title,
      author: t.author,
      uri: t.uri ?? null,
      length: t.duration,
      artworkUrl: t.artworkUrl ?? null,
      identifier: "",
      isStream: false,
      position: 0,
      isSeekable: true,
      sourceName: "",
      isrc: null,
    },
    pluginInfo: {},
    userData: {},
  }));

  // Use MusicManager.play() to add tracks and start playback if needed
  await music.play(guildId, lavalinkTracks, user.username, user.id);

  broadcastPlayerUpdate(ctx.server, music, guildId);

  return json({
    success: true,
    message: `Added ${lavalinkTracks.length} tracks from "${playlist.name}" to queue`,
    addedCount: lavalinkTracks.length,
  });
};
