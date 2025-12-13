import type { WSContext, WSHandler } from "@/api/server";
import { formatTrack } from "@/api/routes/guilds/[guildId]/helpers";
import { requireGuild, requireMusic } from "./utils";

export const historyHandlers: Record<string, WSHandler> = {
  getHistory: async (ctx: WSContext) => {
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!guildId || !music) return;

    const limit = (ctx.data.limit as number) ?? 20;
    const queue = music.queues.get(guildId);

    const history = queue?.getHistory(limit).map((t) => ({
      ...formatTrack(t),
      playedAt: t.playedAt,
    })) ?? [];

    ctx.ws.send(JSON.stringify({ type: "history", history }));
  },
};
