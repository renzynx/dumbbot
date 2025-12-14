import type { ServerWebSocket } from "bun";

/**
 * WebSocket connection data
 */
export interface WebSocketData {
  userId?: string;
  guildId?: string;
  subscriptions: Set<string>;
}

/**
 * WebSocket message format
 */
export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Route context passed to handlers
 * @typeParam TClient - The client type (e.g., BotClient)
 * @typeParam TServer - The API server type
 */
export interface RouteContext<TClient = unknown, TServer = unknown> {
  /** The incoming request */
  req: Request;
  /** URL path parameters */
  params: Record<string, string>;
  /** URL query parameters */
  query: URLSearchParams;
  /** Application client instance */
  client: TClient;
  /** API server instance */
  server: TServer;
  /** Authenticated user (if any) */
  user?: unknown;
  /** Parse request body as JSON */
  json: <T = unknown>() => Promise<T>;
}

/**
 * WebSocket context passed to handlers
 * @typeParam TClient - The client type
 * @typeParam TServer - The API server type
 */
export interface WSContext<TClient = unknown, TServer = unknown> {
  /** WebSocket connection */
  ws: ServerWebSocket<WebSocketData>;
  /** Message data */
  data: Record<string, unknown>;
  /** Application client instance */
  client: TClient;
  /** API server instance */
  server: TServer;
}

/**
 * Route handler function
 */
export type RouteHandler<TClient = unknown, TServer = unknown> = (
  ctx: RouteContext<TClient, TServer>
) => Response | Promise<Response>;

/**
 * WebSocket handler function
 */
export type WSHandler<TClient = unknown, TServer = unknown> = (
  ctx: WSContext<TClient, TServer>
) => void | Promise<void>;

/**
 * Middleware function
 */
export type Middleware<TClient = unknown, TServer = unknown> = (
  ctx: RouteContext<TClient, TServer>,
  next: () => Promise<Response>
) => Response | Promise<Response>;

/**
 * Route module exports
 */
export interface RouteModule<TClient = unknown, TServer = unknown> {
  GET?: RouteHandler<TClient, TServer>;
  POST?: RouteHandler<TClient, TServer>;
  PUT?: RouteHandler<TClient, TServer>;
  PATCH?: RouteHandler<TClient, TServer>;
  DELETE?: RouteHandler<TClient, TServer>;
  middleware?: Middleware<TClient, TServer>[];
}

/**
 * WebSocket module exports
 */
export interface WSModule<TClient = unknown, TServer = unknown> {
  handlers: Record<string, WSHandler<TClient, TServer>>;
}

/**
 * Logger interface for the API server
 */
export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  success(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * API server configuration options
 */
export interface APIServerOptions<TClient = unknown> {
  /** Application client instance */
  client: TClient;
  /** Logger instance (optional) */
  logger?: Logger;
  /** Route prefix (default: /api) */
  routePrefix?: string;
  /** Allowed origins for CORS (comma-separated or array) */
  allowedOrigins?: string | string[];
  /** WebSocket endpoint path (default: /ws) */
  wsPath?: string;
  /** WebSocket idle timeout in seconds (default: 120) */
  wsIdleTimeout?: number;
}

/**
 * Compiled route for internal use
 */
export interface CompiledRoute<TClient = unknown, TServer = unknown> {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler<TClient, TServer>;
  middleware: Middleware<TClient, TServer>[];
}
