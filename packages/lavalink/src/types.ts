// ==================== Track Types ====================

export interface TrackInfo {
  identifier: string;
  isSeekable: boolean;
  author: string;
  length: number;
  isStream: boolean;
  position: number;
  title: string;
  uri: string | null;
  artworkUrl: string | null;
  isrc: string | null;
  sourceName: string;
}

export interface Track {
  encoded: string;
  info: TrackInfo;
  pluginInfo: Record<string, unknown>;
  userData: Record<string, unknown>;
}

export interface PlaylistInfo {
  name: string;
  selectedTrack: number;
}

// ==================== Load Result Types ====================

export type LoadResultType = "track" | "playlist" | "search" | "empty" | "error";

export interface TrackLoadResult {
  loadType: "track";
  data: Track;
}

export interface PlaylistLoadResult {
  loadType: "playlist";
  data: {
    info: PlaylistInfo;
    pluginInfo: Record<string, unknown>;
    tracks: Track[];
  };
}

export interface SearchLoadResult {
  loadType: "search";
  data: Track[];
}

export interface EmptyLoadResult {
  loadType: "empty";
  data: Record<string, never>;
}

export interface ErrorLoadResult {
  loadType: "error";
  data: Exception;
}

export type LoadResult =
  | TrackLoadResult
  | PlaylistLoadResult
  | SearchLoadResult
  | EmptyLoadResult
  | ErrorLoadResult;

// ==================== Player Types ====================

export interface PlayerState {
  time: number;
  position: number;
  connected: boolean;
  ping: number;
}

export interface VoiceState {
  token: string;
  endpoint: string;
  sessionId: string;
}

export interface Player {
  guildId: string;
  track: Track | null;
  volume: number;
  paused: boolean;
  state: PlayerState;
  voice: VoiceState;
  filters: Filters;
}

// ==================== Filter Types ====================

export interface Equalizer {
  band: number;
  gain: number;
}

export interface Karaoke {
  level?: number;
  monoLevel?: number;
  filterBand?: number;
  filterWidth?: number;
}

export interface Timescale {
  speed?: number;
  pitch?: number;
  rate?: number;
}

export interface Tremolo {
  frequency?: number;
  depth?: number;
}

export interface Vibrato {
  frequency?: number;
  depth?: number;
}

export interface Rotation {
  rotationHz?: number;
}

export interface Distortion {
  sinOffset?: number;
  sinScale?: number;
  cosOffset?: number;
  cosScale?: number;
  tanOffset?: number;
  tanScale?: number;
  offset?: number;
  scale?: number;
}

export interface ChannelMix {
  leftToLeft?: number;
  leftToRight?: number;
  rightToLeft?: number;
  rightToRight?: number;
}

export interface LowPass {
  smoothing?: number;
}

export interface Filters {
  volume?: number;
  equalizer?: Equalizer[];
  karaoke?: Karaoke;
  timescale?: Timescale;
  tremolo?: Tremolo;
  vibrato?: Vibrato;
  rotation?: Rotation;
  distortion?: Distortion;
  channelMix?: ChannelMix;
  lowPass?: LowPass;
  pluginFilters?: Record<string, Record<string, unknown>>;
}

// ==================== Update Player Types ====================

export interface UpdatePlayerTrack {
  encoded?: string | null;
  identifier?: string;
  userData?: Record<string, unknown>;
}

export interface UpdatePlayerOptions {
  track?: UpdatePlayerTrack;
  position?: number;
  endTime?: number | null;
  volume?: number;
  paused?: boolean;
  filters?: Filters;
  voice?: VoiceState;
}

// ==================== Session Types ====================

export interface SessionUpdate {
  resuming?: boolean;
  timeout?: number;
}

export interface SessionInfo {
  resuming: boolean;
  timeout: number;
}

// ==================== Info Types ====================

export interface LavalinkVersion {
  semver: string;
  major: number;
  minor: number;
  patch: number;
  preRelease: string | null;
  build: string | null;
}

export interface LavalinkGit {
  branch: string;
  commit: string;
  commitTime: number;
}

export interface LavalinkPlugin {
  name: string;
  version: string;
}

export interface LavalinkInfo {
  version: LavalinkVersion;
  buildTime: number;
  git: LavalinkGit;
  jvm: string;
  lavaplayer: string;
  sourceManagers: string[];
  filters: string[];
  plugins: LavalinkPlugin[];
}

// ==================== Stats Types ====================

export interface LavalinkMemory {
  free: number;
  used: number;
  allocated: number;
  reservable: number;
}

export interface LavalinkCpu {
  cores: number;
  systemLoad: number;
  lavalinkLoad: number;
}

export interface LavalinkFrameStats {
  sent: number;
  nulled: number;
  deficit: number;
}

export interface LavalinkStats {
  players: number;
  playingPlayers: number;
  uptime: number;
  memory: LavalinkMemory;
  cpu: LavalinkCpu;
  frameStats?: LavalinkFrameStats;
}

// ==================== Route Planner Types ====================

export type RoutePlannerType =
  | "RotatingIpRoutePlanner"
  | "NanoIpRoutePlanner"
  | "RotatingNanoIpRoutePlanner"
  | "BalancingIpRoutePlanner";

export type IpBlockType = "Inet4Address" | "Inet6Address";

export interface IpBlock {
  type: IpBlockType;
  size: string;
}

export interface FailingAddress {
  failingAddress: string;
  failingTimestamp: number;
  failingTime: string;
}

export interface RoutePlannerDetails {
  ipBlock: IpBlock;
  failingAddresses: FailingAddress[];
  rotateIndex?: string;
  ipIndex?: string;
  currentAddress?: string;
  currentAddressIndex?: string;
  blockIndex?: string;
}

export interface RoutePlannerStatus {
  class: RoutePlannerType | null;
  details: RoutePlannerDetails | null;
}

// ==================== Error Types ====================

export interface LavalinkError {
  timestamp: number;
  status: number;
  error: string;
  trace?: string;
  message: string;
  path: string;
}

export interface Exception {
  message: string | null;
  severity: "common" | "suspicious" | "fault";
  cause: string;
  causeStackTrace?: string;
}

// ==================== WebSocket Types ====================

export type OpType = "ready" | "playerUpdate" | "stats" | "event";

export interface ReadyOp {
  op: "ready";
  resumed: boolean;
  sessionId: string;
}

export interface PlayerUpdateOp {
  op: "playerUpdate";
  guildId: string;
  state: PlayerState;
}

export interface StatsOp extends LavalinkStats {
  op: "stats";
}

// ==================== Event Types ====================

export type EventType =
  | "TrackStartEvent"
  | "TrackEndEvent"
  | "TrackExceptionEvent"
  | "TrackStuckEvent"
  | "WebSocketClosedEvent";

export type TrackEndReason = "finished" | "loadFailed" | "stopped" | "replaced" | "cleanup";

export interface TrackStartEvent {
  op: "event";
  type: "TrackStartEvent";
  guildId: string;
  track: Track;
}

export interface TrackEndEvent {
  op: "event";
  type: "TrackEndEvent";
  guildId: string;
  track: Track;
  reason: TrackEndReason;
}

export interface TrackExceptionEvent {
  op: "event";
  type: "TrackExceptionEvent";
  guildId: string;
  track: Track;
  exception: Exception;
}

export interface TrackStuckEvent {
  op: "event";
  type: "TrackStuckEvent";
  guildId: string;
  track: Track;
  thresholdMs: number;
}

export interface WebSocketClosedEvent {
  op: "event";
  type: "WebSocketClosedEvent";
  guildId: string;
  code: number;
  reason: string;
  byRemote: boolean;
}

export type LavalinkEvent =
  | TrackStartEvent
  | TrackEndEvent
  | TrackExceptionEvent
  | TrackStuckEvent
  | WebSocketClosedEvent;

export type LavalinkMessage = ReadyOp | PlayerUpdateOp | StatsOp | LavalinkEvent;

// ==================== Node Configuration ====================

export interface LavalinkNodeOptions {
  /** Lavalink server host */
  host: string;
  /** Lavalink server port (default: 2333) */
  port?: number;
  /** Use secure connection (default: false) */
  secure?: boolean;
  /** Lavalink server password */
  password: string;
  /** Client name for identification */
  clientName?: string;
  /** User ID of the bot */
  userId: string;
  /** Session ID for resuming */
  sessionId?: string;
  /** Reconnect options */
  reconnect?: {
    /** Number of retries (default: 5) */
    retries?: number;
    /** Delay between retries in ms (default: 5000) */
    delay?: number;
  };
}
