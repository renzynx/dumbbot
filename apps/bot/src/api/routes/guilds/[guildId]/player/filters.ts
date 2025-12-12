import { json, type RouteHandler } from "@/api/server";
import { requireAuth, requireGuildAccess } from "@/api/middleware/auth";
import { broadcastPlayerUpdate } from "../helpers";
import type { Filters } from "@discordbot/lavalink";

export const middleware = [requireAuth, requireGuildAccess];

/**
 * Filter presets available to users
 */
const FILTER_PRESETS: Record<string, { name: string; description: string; filters: Filters }> = {
  nightcore: {
    name: "Nightcore",
    description: "Higher pitch and faster tempo",
    filters: {
      timescale: { speed: 1.25, pitch: 1.3, rate: 1.0 },
    },
  },
  vaporwave: {
    name: "Vaporwave",
    description: "Slowed down with lower pitch",
    filters: {
      timescale: { speed: 0.85, pitch: 0.8, rate: 1.0 },
    },
  },
  bass: {
    name: "Bass Boost",
    description: "Enhanced bass frequencies",
    filters: {
      equalizer: [
        { band: 0, gain: 0.6 },
        { band: 1, gain: 0.5 },
        { band: 2, gain: 0.4 },
        { band: 3, gain: 0.25 },
        { band: 4, gain: 0.15 },
        { band: 5, gain: 0.0 },
        { band: 6, gain: -0.1 },
        { band: 7, gain: -0.1 },
        { band: 8, gain: -0.1 },
        { band: 9, gain: -0.1 },
        { band: 10, gain: -0.1 },
        { band: 11, gain: -0.1 },
        { band: 12, gain: -0.1 },
        { band: 13, gain: -0.1 },
        { band: 14, gain: -0.1 },
      ],
    },
  },
  treble: {
    name: "Treble Boost",
    description: "Enhanced high frequencies",
    filters: {
      equalizer: [
        { band: 0, gain: -0.1 },
        { band: 1, gain: -0.1 },
        { band: 2, gain: -0.1 },
        { band: 3, gain: -0.1 },
        { band: 4, gain: -0.1 },
        { band: 5, gain: 0.0 },
        { band: 6, gain: 0.1 },
        { band: 7, gain: 0.2 },
        { band: 8, gain: 0.3 },
        { band: 9, gain: 0.4 },
        { band: 10, gain: 0.45 },
        { band: 11, gain: 0.5 },
        { band: 12, gain: 0.55 },
        { band: 13, gain: 0.6 },
        { band: 14, gain: 0.6 },
      ],
    },
  },
  "8d": {
    name: "8D Audio",
    description: "Rotating audio effect",
    filters: {
      rotation: { rotationHz: 0.2 },
    },
  },
  karaoke: {
    name: "Karaoke",
    description: "Reduces vocals in the track",
    filters: {
      karaoke: {
        level: 1.0,
        monoLevel: 1.0,
        filterBand: 220.0,
        filterWidth: 100.0,
      },
    },
  },
  vibrato: {
    name: "Vibrato",
    description: "Adds vibrato effect",
    filters: {
      vibrato: { frequency: 4.0, depth: 0.75 },
    },
  },
  tremolo: {
    name: "Tremolo",
    description: "Adds tremolo effect",
    filters: {
      tremolo: { frequency: 4.0, depth: 0.75 },
    },
  },
  lowpass: {
    name: "Low Pass",
    description: "Muffled/underwater sound",
    filters: {
      lowPass: { smoothing: 20.0 },
    },
  },
  slowed: {
    name: "Slowed",
    description: "Slowed down playback",
    filters: {
      timescale: { speed: 0.8, pitch: 1.0, rate: 1.0 },
    },
  },
  speed: {
    name: "Speed Up",
    description: "Faster playback",
    filters: {
      timescale: { speed: 1.25, pitch: 1.0, rate: 1.0 },
    },
  },
  chipmunk: {
    name: "Chipmunk",
    description: "High pitched voice",
    filters: {
      timescale: { speed: 1.05, pitch: 1.35, rate: 1.25 },
    },
  },
  darth: {
    name: "Darth Vader",
    description: "Deep voice effect",
    filters: {
      timescale: { speed: 0.975, pitch: 0.5, rate: 0.8 },
    },
  },
  soft: {
    name: "Soft",
    description: "Softer, smoother sound",
    filters: {
      lowPass: { smoothing: 10.0 },
      equalizer: [
        { band: 0, gain: -0.2 },
        { band: 1, gain: -0.1 },
        { band: 2, gain: 0.0 },
        { band: 3, gain: 0.1 },
        { band: 4, gain: 0.15 },
        { band: 5, gain: 0.1 },
        { band: 6, gain: 0.05 },
        { band: 7, gain: 0.0 },
        { band: 8, gain: -0.05 },
        { band: 9, gain: -0.1 },
        { band: 10, gain: -0.15 },
        { band: 11, gain: -0.2 },
        { band: 12, gain: -0.25 },
        { band: 13, gain: -0.3 },
        { band: 14, gain: -0.35 },
      ],
    },
  },
};

/**
 * GET /api/guilds/:guildId/player/filters
 * Get available filter presets
 */
export const GET: RouteHandler = async () => {
  const presets = Object.entries(FILTER_PRESETS).map(([id, preset]) => ({
    id,
    name: preset.name,
    description: preset.description,
  }));

  return json({ presets });
};

/**
 * POST /api/guilds/:guildId/player/filters
 * Apply a filter preset
 */
export const POST: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  const queue = music.queues.get(guildId);
  if (!queue?.current) {
    return json({ error: "Nothing is playing" }, 400);
  }

  const body = await ctx.json<{ preset: string }>();

  if (!body.preset) {
    return json({ error: "Preset is required" }, 400);
  }

  const preset = FILTER_PRESETS[body.preset];
  if (!preset) {
    return json({ error: "Unknown filter preset" }, 400);
  }

  await music.setFilters(guildId, preset.filters);
  broadcastPlayerUpdate(ctx.server, music, guildId);

  return json({ 
    success: true, 
    message: `Applied ${preset.name} filter`,
    activeFilter: body.preset,
  });
};

/**
 * DELETE /api/guilds/:guildId/player/filters
 * Clear all filters
 */
export const DELETE: RouteHandler = async (ctx) => {
  const guildId = ctx.params.guildId!;
  const music = ctx.client.music;

  if (!music) {
    return json({ error: "Music system not available" }, 503);
  }

  await music.clearFilters(guildId);
  broadcastPlayerUpdate(ctx.server, music, guildId);

  return json({ success: true, message: "Filters cleared" });
};
