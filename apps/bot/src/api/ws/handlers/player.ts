import type { WSContext, WSHandler } from "@/api/server";
import { LoopMode } from "@/music/Queue";
import {
  sendError,
  sendSuccess,
  broadcastPlayerUpdate,
  requireAuth,
  requireGuild,
  requireMusic,
  requireDJPermissions,
  handleVoteSkip,
} from "./utils";

export const playerHandlers: Record<string, WSHandler> = {
  play: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    // Check DJ permissions for play/resume
    if (!requireDJPermissions(ctx, guildId, userId)) return;

    const node = music.getIdealNode();
    const player = node?.getPlayer(guildId);
    if (!player) {
      sendError(ctx, "No active player");
      return;
    }

    await music.resume(guildId);
    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx);
  },

  pause: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    // Check DJ permissions for pause
    if (!requireDJPermissions(ctx, guildId, userId)) return;

    await music.pause(guildId);
    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx);
  },

  skip: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    // Handle vote skip if enabled, otherwise check DJ permissions
    const voteResult = await handleVoteSkip(ctx, guildId, userId);

    if (!voteResult.canSkip) {
      if (voteResult.message) {
        // Send info message (vote added, already voted, etc.)
        ctx.ws.send(JSON.stringify({ type: "info", message: voteResult.message }));
      }
      // If vote skip was triggered and passed, the skip already happened
      if (voteResult.message?.includes("Skipping")) {
        broadcastPlayerUpdate(ctx, guildId);
      }
      return;
    }

    await music.skip(guildId);
    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx);
  },

  stop: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    // Check DJ permissions for stop
    if (!requireDJPermissions(ctx, guildId, userId)) return;

    await music.stop(guildId);
    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx);
  },

  seek: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    // Check DJ permissions for seek
    if (!requireDJPermissions(ctx, guildId, userId)) return;

    const position = ctx.data.position as number | undefined;
    if (typeof position !== "number") {
      sendError(ctx, "Invalid position");
      return;
    }

    await music.seek(guildId, position);
    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx);
  },

  volume: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    // Check DJ permissions for volume
    if (!requireDJPermissions(ctx, guildId, userId)) return;

    const volume = ctx.data.volume as number | undefined;
    if (typeof volume !== "number" || volume < 0 || volume > 200) {
      sendError(ctx, "Invalid volume (0-200)");
      return;
    }

    await music.setVolume(guildId, volume);
    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx, { volume });
  },

  loop: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    // Check DJ permissions for loop mode
    if (!requireDJPermissions(ctx, guildId, userId)) return;

    const mode = ctx.data.mode as string | undefined;
    const modeMap: Record<string, LoopMode> = {
      none: LoopMode.None,
      track: LoopMode.Track,
      queue: LoopMode.Queue,
    };

    const loopMode = modeMap[mode ?? ""];
    if (loopMode === undefined) {
      sendError(ctx, "Invalid loop mode (none, track, queue)");
      return;
    }

    music.setLoopMode(guildId, loopMode);
    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx, { loopMode: mode });
  },

  shuffle: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    // Check DJ permissions for shuffle
    if (!requireDJPermissions(ctx, guildId, userId)) return;

    const queue = music.queues.get(guildId);
    if (!queue) {
      sendError(ctx, "No active queue");
      return;
    }

    music.shuffle(guildId);
    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx, { message: "Queue shuffled" });
  },
};
