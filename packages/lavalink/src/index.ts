// Main exports
export { LavalinkNode, type LavalinkNodeEvents } from "./node.js";
export { LavalinkRest } from "./rest.js";
export { LavalinkSocket, type LavalinkSocketEvents } from "./socket.js";

// Type exports
export type {
  // Track types
  Track,
  TrackInfo,
  PlaylistInfo,

  // Load result types
  LoadResult,
  LoadResultType,
  TrackLoadResult,
  PlaylistLoadResult,
  SearchLoadResult,
  EmptyLoadResult,
  ErrorLoadResult,

  // Player types
  Player,
  PlayerState,
  VoiceState,
  UpdatePlayerOptions,
  UpdatePlayerTrack,

  // Filter types
  Filters,
  Equalizer,
  Karaoke,
  Timescale,
  Tremolo,
  Vibrato,
  Rotation,
  Distortion,
  ChannelMix,
  LowPass,

  // Session types
  SessionInfo,
  SessionUpdate,

  // Info types
  LavalinkInfo,
  LavalinkVersion,
  LavalinkGit,
  LavalinkPlugin,

  // Stats types
  LavalinkStats,
  LavalinkMemory,
  LavalinkCpu,
  LavalinkFrameStats,

  // Route planner types
  RoutePlannerStatus,
  RoutePlannerType,
  RoutePlannerDetails,
  IpBlock,
  IpBlockType,
  FailingAddress,

  // Error types
  LavalinkError,
  Exception,

  // WebSocket message types
  LavalinkMessage,
  OpType,
  ReadyOp,
  PlayerUpdateOp,
  StatsOp,

  // Event types
  LavalinkEvent,
  EventType,
  TrackEndReason,
  TrackStartEvent,
  TrackEndEvent,
  TrackExceptionEvent,
  TrackStuckEvent,
  WebSocketClosedEvent,

  // Configuration
  LavalinkNodeOptions,
} from "./types.js";
