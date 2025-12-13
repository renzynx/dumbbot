import type { ServerWebSocket } from "bun";
import type { BotClient } from "@/core/Client";
import type { AuthUser } from "@discordbot/shared-types";

export type { AuthUser } from "@discordbot/shared-types";

export interface RouteContext {
  req: Request;
  params: Record<string, string>;
  query: URLSearchParams;
  client: BotClient;
  server: APIServer;
  user?: AuthUser;
  json: <T = unknown>() => Promise<T>;
}

export interface WebSocketData {
  userId?: string;
  guildId?: string;
  subscriptions: Set<string>;
}

export interface WSContext {
  ws: ServerWebSocket<WebSocketData>;
  data: Record<string, unknown>;
  client: BotClient;
  server: APIServer;
}

export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

export type RouteHandler = (ctx: RouteContext) => Response | Promise<Response>;
export type WSHandler = (ctx: WSContext) => void | Promise<void>;
export type Middleware = (ctx: RouteContext, next: () => Promise<Response>) => Response | Promise<Response>;

export interface RouteModule {
  GET?: RouteHandler;
  POST?: RouteHandler;
  PUT?: RouteHandler;
  PATCH?: RouteHandler;
  DELETE?: RouteHandler;
  middleware?: Middleware[];
}

export interface WSModule {
  handlers: Record<string, WSHandler>;
}

// Type alias for APIServer to avoid circular dependency
export type APIServer = import("../api/server").APIServer;