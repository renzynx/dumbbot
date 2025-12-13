import type { Filters } from "@discordbot/lavalink";

// Filter presets for audio effects
export const FILTER_PRESETS: Record<string, { name: string; filters: Filters }> = {
  nightcore: {
    name: "Nightcore",
    filters: { timescale: { speed: 1.25, pitch: 1.3, rate: 1.0 } },
  },
  vaporwave: {
    name: "Vaporwave",
    filters: { timescale: { speed: 0.85, pitch: 0.8, rate: 1.0 } },
  },
  bass: {
    name: "Bass Boost",
    filters: {
      equalizer: [
        { band: 0, gain: 0.6 }, { band: 1, gain: 0.5 }, { band: 2, gain: 0.4 },
        { band: 3, gain: 0.25 }, { band: 4, gain: 0.15 }, { band: 5, gain: 0.0 },
        { band: 6, gain: -0.1 }, { band: 7, gain: -0.1 }, { band: 8, gain: -0.1 },
        { band: 9, gain: -0.1 }, { band: 10, gain: -0.1 }, { band: 11, gain: -0.1 },
        { band: 12, gain: -0.1 }, { band: 13, gain: -0.1 }, { band: 14, gain: -0.1 },
      ],
    },
  },
  treble: {
    name: "Treble Boost",
    filters: {
      equalizer: [
        { band: 0, gain: -0.1 }, { band: 1, gain: -0.1 }, { band: 2, gain: -0.1 },
        { band: 3, gain: -0.1 }, { band: 4, gain: -0.1 }, { band: 5, gain: 0.0 },
        { band: 6, gain: 0.1 }, { band: 7, gain: 0.2 }, { band: 8, gain: 0.3 },
        { band: 9, gain: 0.4 }, { band: 10, gain: 0.45 }, { band: 11, gain: 0.5 },
        { band: 12, gain: 0.55 }, { band: 13, gain: 0.6 }, { band: 14, gain: 0.6 },
      ],
    },
  },
  "8d": {
    name: "8D Audio",
    filters: { rotation: { rotationHz: 0.2 } },
  },
  karaoke: {
    name: "Karaoke",
    filters: { karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 } },
  },
  vibrato: {
    name: "Vibrato",
    filters: { vibrato: { frequency: 4.0, depth: 0.75 } },
  },
  tremolo: {
    name: "Tremolo",
    filters: { tremolo: { frequency: 4.0, depth: 0.75 } },
  },
  lowpass: {
    name: "Low Pass",
    filters: { lowPass: { smoothing: 20.0 } },
  },
  slowed: {
    name: "Slowed",
    filters: { timescale: { speed: 0.8, pitch: 1.0, rate: 1.0 } },
  },
  speed: {
    name: "Speed Up",
    filters: { timescale: { speed: 1.25, pitch: 1.0, rate: 1.0 } },
  },
  chipmunk: {
    name: "Chipmunk",
    filters: { timescale: { speed: 1.05, pitch: 1.35, rate: 1.25 } },
  },
  darth: {
    name: "Darth Vader",
    filters: { timescale: { speed: 0.975, pitch: 0.5, rate: 0.8 } },
  },
};
