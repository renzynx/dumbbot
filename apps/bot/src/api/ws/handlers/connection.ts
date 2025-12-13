import type { WSContext, WSHandler } from "@/api/server";
import { LoopMode } from "@/music/Queue";
import { formatTrack } from "@/api/routes/guilds/[guildId]/helpers";
import { validateWSToken } from "@/db/sessions";
import { sendError } from "./utils";

export const connectionHandlers: Record<string, WSHandler> = {
  subscribe: async (ctx: WSContext) => {
    const guildId = ctx.data.guildId as string | undefined;
    if (!guildId) {
      sendError(ctx, "Guild ID is required");
      return;
    }

    ctx.ws.data.subscriptions.add(guildId);
    ctx.ws.data.guildId = guildId;

    // Send current state
    const music = ctx.client.music;
    if (music) {
      const queue = music.queues.get(guildId);
      const node = music.getIdealNode();
      const player = node?.getPlayer(guildId);
      const settings = music.settings.get(guildId);

      ctx.ws.send(
        JSON.stringify({
          type: "playerUpdate",
          data: {
            playing: !!queue?.current,
            current: queue?.current ? formatTrack(queue.current) : null,
            queue: queue?.tracks.map((t) => formatTrack(t)) ?? [],
            position: player?.state.position ?? 0,
            volume: queue?.volume ?? settings.defaultVolume,
            loopMode: queue?.loopMode ?? LoopMode.None,
            paused: player?.paused ?? false,
            settings: {
              defaultVolume: settings.defaultVolume,
              djOnlyMode: settings.djOnlyMode,
              twentyFourSevenMode: settings.twentyFourSevenMode,
              autoplayEnabled: settings.autoplayEnabled,
              voteSkipEnabled: settings.voteSkipEnabled,
              voteSkipPercentage: settings.voteSkipPercentage,
            },
          },
        })
      );
    }
  },

  unsubscribe: async (ctx: WSContext) => {
    const guildId = ctx.data.guildId as string | undefined;
    if (guildId) {
      ctx.ws.data.subscriptions.delete(guildId);
      if (ctx.ws.data.guildId === guildId) {
        ctx.ws.data.guildId = undefined;
      }
    }
  },

  ping: async (ctx: WSContext) => {
    ctx.ws.send(JSON.stringify({ type: "pong" }));
  },

  auth: async (ctx: WSContext) => {
    const token = ctx.data.token as string | undefined;
    if (!token) {
      sendError(ctx, "Token is required");
      return;
    }

    // Validate the short-lived WS token
    const userId = validateWSToken(token);
    if (!userId) {
      sendError(ctx, "Invalid or expired token");
      return;
    }

    ctx.ws.data.userId = userId;
    ctx.ws.send(JSON.stringify({ type: "authenticated", userId }));
  },
};
