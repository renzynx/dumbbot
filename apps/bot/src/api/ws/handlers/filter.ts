import type { WSContext, WSHandler } from "@/api/server";
import { formatTrack } from "@/api/routes/guilds/[guildId]/helpers";
import { FILTER_PRESETS } from "./filters";
import {
  sendError,
  sendSuccess,
  broadcastPlayerUpdate,
  requireAuth,
  requireGuild,
  requireMusic,
} from "./utils";

export const filterHandlers: Record<string, WSHandler> = {
  getFilters: async (ctx: WSContext) => {
    const presets = Object.entries(FILTER_PRESETS).map(([id, preset]) => ({
      id,
      name: preset.name,
    }));

    ctx.ws.send(JSON.stringify({ type: "filters", presets }));
  },

  applyFilter: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    const preset = ctx.data.preset as string | undefined;
    if (!preset) {
      sendError(ctx, "Preset is required");
      return;
    }

    const filterPreset = FILTER_PRESETS[preset];
    if (!filterPreset) {
      sendError(ctx, "Unknown filter preset");
      return;
    }

    const queue = music.queues.get(guildId);
    if (!queue?.current) {
      sendError(ctx, "Nothing is playing");
      return;
    }

    await music.setFilters(guildId, filterPreset.filters);
    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx, { message: `Applied ${filterPreset.name} filter`, activeFilter: preset });
  },

  clearFilters: async (ctx: WSContext) => {
    const userId = requireAuth(ctx);
    const guildId = requireGuild(ctx);
    const music = requireMusic(ctx);
    if (!userId || !guildId || !music) return;

    await music.clearFilters(guildId);
    broadcastPlayerUpdate(ctx, guildId);
    sendSuccess(ctx, { message: "Filters cleared" });
  },
};
