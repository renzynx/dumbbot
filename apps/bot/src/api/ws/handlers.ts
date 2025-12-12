import type { WSContext, WSHandler } from "@/api/server";
import { LoopMode } from "@/music/Queue";
import { formatTrack } from "@/api/routes/guilds/[guildId]/helpers";

/**
 * Create WebSocket handlers for the API server
 */
export function createWSHandlers(): Record<string, WSHandler> {
  return {
    /**
     * Subscribe to guild updates
     */
    subscribe: async (ctx: WSContext) => {
      const guildId = ctx.data.guildId as string | undefined;
      if (!guildId) {
        ctx.ws.send(JSON.stringify({ type: "error", message: "Guild ID is required" }));
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

    /**
     * Unsubscribe from guild updates
     */
    unsubscribe: async (ctx: WSContext) => {
      const guildId = ctx.data.guildId as string | undefined;
      if (guildId) {
        ctx.ws.data.subscriptions.delete(guildId);
        if (ctx.ws.data.guildId === guildId) {
          ctx.ws.data.guildId = undefined;
        }
      }
    },

    /**
     * Ping/pong for keepalive
     */
    ping: async (ctx: WSContext) => {
      ctx.ws.send(JSON.stringify({ type: "pong" }));
    },

    /**
     * Authenticate WebSocket connection
     */
    auth: async (ctx: WSContext) => {
      const token = ctx.data.token as string | undefined;
      if (!token) {
        ctx.ws.send(JSON.stringify({ type: "error", message: "Token is required" }));
        return;
      }

      const { getSessionWithAccount } = await import("@/db/sessions");
      const result = await getSessionWithAccount(token);
      if (!result) {
        ctx.ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
        return;
      }

      ctx.ws.data.userId = result.account.userId;
      ctx.ws.send(JSON.stringify({ type: "authenticated", userId: result.account.userId }));
    },
  };
}
