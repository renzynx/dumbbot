import type { WSContext, WSHandler } from "@/types/api";
import { formatTrack, ensureVoiceConnection } from "@/api/routes/guilds/[guildId]/helpers";
import {
  sendError,
  sendSuccess,
  broadcastPlayerUpdate,
  requireAuth,
  requireGuild,
  requireMusic,
  requireDJPermissions,
} from "./utils";

export const queueHandlers: Record<string, WSHandler> = {
  addTrack: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    const query = ctx.data.query as string | undefined;
    if (!query) {
      sendError(ctx, "Query is required");
      return;
    }

    // Ensure bot is connected to voice channel
    const voiceError = await ensureVoiceConnection(music, ctx.client, guildId, userId);
    if (voiceError) {
      sendError(ctx, voiceError);
      return;
    }

    // Search for tracks
    const result = await music.search(query);
    if (result.loadType === "error" || result.loadType === "empty") {
      sendError(ctx, "No results found");
      return;
    }

    const queue = music.getQueue(guildId);
    const username = ctx.data.username as string ?? "Web User";

    let added = 0;
    if (result.loadType === "playlist" && result.data.tracks) {
      for (const track of result.data.tracks) {
        queue.add(track, username, userId);
        added++;
      }
    } else if (result.loadType === "search" || result.loadType === "track") {
      const tracks = result.loadType === "search" ? result.data : [result.data];
      if (tracks.length > 0) {
        queue.add(tracks[0]!, username, userId);
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

    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx, { added, message: `Added ${added} track${added !== 1 ? "s" : ""} to queue` });
  },

  removeTrack: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    const position = ctx.data.position as number | undefined;
    if (typeof position !== "number" || position < 0) {
      sendError(ctx, "Invalid position");
      return;
    }

    const queue = music.queues.get(guildId);
    if (!queue) {
      sendError(ctx, "No active queue");
      return;
    }

    // Allow users to remove their own tracks, require DJ to remove others
    const track = queue.tracks[position];
    if (track && track.requesterId !== userId) {
      if (!requireDJPermissions(ctx, guildId, userId)) return;
    }

    const removed = queue.remove(position);
    if (!removed) {
      sendError(ctx, "Invalid position");
      return;
    }

    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx, { removed: formatTrack(removed) });
  },

  moveTrack: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    // Require DJ permissions to move tracks
    if (!requireDJPermissions(ctx, guildId, userId)) return;

    const from = ctx.data.from as number | undefined;
    const to = ctx.data.to as number | undefined;
    if (typeof from !== "number" || typeof to !== "number") {
      sendError(ctx, "Invalid positions");
      return;
    }

    const queue = music.queues.get(guildId);
    if (!queue) {
      sendError(ctx, "No active queue");
      return;
    }

    const success = queue.move(from, to);
    if (!success) {
      sendError(ctx, "Invalid positions");
      return;
    }

    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx);
  },

  clearQueue: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    // Require DJ permissions to clear the entire queue
    if (!requireDJPermissions(ctx, guildId, userId)) return;

    const queue = music.queues.get(guildId);
    if (!queue) {
      sendError(ctx, "No active queue");
      return;
    }

    queue.clear();
    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx, { message: "Queue cleared" });
  },
};
