import type { ServerWebSocket } from "bun";
import { Glob } from "bun";
import { relative } from "node:path";
import type { BotClient } from "@/core/Client";
import { Logger } from "@/utils/Logger";
import { cleanupExpiredSessions, cleanupExpiredWSTokens, cleanupExpiredOAuthStates } from "@/db/sessions";
import type {
  RouteContext,
  WebSocketData,
  WSContext,
  WSMessage,
  RouteHandler,
  WSHandler,
  Middleware,
  RouteModule,
  WSModule,
} from "@/types/api";

// Re-export types for use by routes
export type {
  RouteContext,
  WebSocketData,
  WSContext,
  WSMessage,
  RouteHandler,
  WSHandler,
  Middleware,
  RouteModule,
  WSModule,
} from "@/types/api";

// ==================== Response Helpers ====================

export function json(data: unknown, status: number = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function redirect(url: string, status: 302 | 301 | 307 | 308 = 302): Response {
  return new Response(null, {
    status,
    headers: { Location: url },
  });
}

// ==================== Compiled Route ====================

interface CompiledRoute {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
  middleware: Middleware[];
}

// ==================== API Server ====================

export class APIServer {
  private server: ReturnType<typeof Bun.serve<WebSocketData>> | null = null;
  private routes: CompiledRoute[] = [];
  private wsHandlers = new Map<string, WSHandler>();
  private globalMiddleware: Middleware[] = [];
  private logger = new Logger("API");
  public readonly client: BotClient;
  private connections: ServerWebSocket<WebSocketData>[] = [];
  private sessionCleanupInterval: ReturnType<typeof setInterval> | null = null;
  private wsTokenCleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(client: BotClient) {
    this.client = client;
  }

  /**
   * Add global middleware
   */
  use(middleware: Middleware): this {
    this.globalMiddleware.push(middleware);
    return this;
  }

  /**
   * Load routes from a directory (file-based routing)
   */
  async loadRoutes(routesDir: string): Promise<void> {
    const glob = new Glob("**/*.ts");
    const files: string[] = [];

    for await (const file of glob.scan({ cwd: routesDir, absolute: true })) {
      files.push(file);
    }

    // Sort files to ensure consistent ordering (specifc routes before dynamic)
    files.sort((a, b) => {
      // Static routes before dynamic routes
      const aHasDynamic = a.includes("[");
      const bHasDynamic = b.includes("[");
      if (aHasDynamic !== bHasDynamic) return aHasDynamic ? 1 : -1;
      return a.localeCompare(b);
    });

    for (const filePath of files) {
      await this.loadRouteFile(filePath, routesDir);
    }

    this.logger.success(`Loaded ${this.routes.length} routes`);
  }

  /**
   * Load a single route file
   */
  private async loadRouteFile(filePath: string, baseDir: string): Promise<void> {
    try {
      const module = await import(filePath) as RouteModule;
      const relativePath = relative(baseDir, filePath);
      const routePath = this.filePathToRoutePath(relativePath);

      const methods: Array<keyof RouteModule> = ["GET", "POST", "PUT", "PATCH", "DELETE"];
      const routeMiddleware = module.middleware ?? [];

      for (const method of methods) {
        const handler = module[method];
        if (typeof handler === "function") {
          const compiled = this.compilePath(routePath);

          this.routes.push({
            method,
            pattern: compiled.pattern,
            paramNames: compiled.paramNames,
            handler,
            middleware: routeMiddleware,
          });

          this.logger.debug(`  ${method} ${routePath}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to load route ${filePath}:`, error);
    }
  }

 private filePathToRoutePath(filePath: string): string {
    let route = filePath
      .replace(/\.ts$/, "")           // Remove .ts extension
      .replace(/\\/g, "/")            // Normalize path separators
      .replace(/\/index$/, "")        // Remove /index suffix
      .replace(/\[([^\]]+)\]/g, ":$1"); // Convert [param] to :param

    return `/api/${route}`;
  }

 private compilePath(path: string): { pattern: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    const patternStr = path.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return "([^/]+)";
    });
    return {
      pattern: new RegExp(`^${patternStr}$`),
      paramNames,
    };
  }

 registerWSHandlers(handlers: Record<string, WSHandler>): this {
    for (const [type, handler] of Object.entries(handlers)) {
      this.wsHandlers.set(type, handler);
      this.logger.debug(`Registered WS handler: ${type}`);
    }
    return this;
  }

 start(port: number = 3001): void {
    const self = this;

    this.server = Bun.serve<WebSocketData>({
      port,

      fetch(req, server) {
        const url = new URL(req.url);

        // Handle WebSocket upgrade
        if (url.pathname === "/ws") {
          const upgraded = server.upgrade(req, {
            data: {
              subscriptions: new Set<string>(),
            },
          });
          if (upgraded) return undefined;
          return new Response("WebSocket upgrade failed", { status: 400 });
        }

        // Handle CORS preflight
        if (req.method === "OPTIONS") {
          return new Response(null, {
            headers: self.corsHeaders(req),
          });
        }

        // Route matching
        return self.handleRequest(req, url);
      },

      websocket: {
        // Increase idle timeout to 2 minutes (client sends ping every 30s)
        idleTimeout: 120,

        open(ws) {
          self.connections.push(ws);
          self.logger.debug(`WebSocket connected (${self.connections.length} total)`);
        },

        message(ws, message) {
          self.handleWSMessage(ws, message);
        },

        close(ws) {
          const idx = self.connections.indexOf(ws);
          if (idx !== -1) self.connections.splice(idx, 1);
          self.logger.debug(`WebSocket disconnected (${self.connections.length} total)`);
        },
      },
    });

    this.logger.success(`API server listening on http://localhost:${port}`);

    this.sessionCleanupInterval = setInterval(() => {
      cleanupExpiredSessions()
        .then(() => this.logger.debug("Session cleanup completed"))
        .catch((err) => this.logger.error("Session cleanup error:", err));
    }, 60 * 60 * 1000); // 1 hour

    // Clean up WS tokens and OAuth states every minute
    this.wsTokenCleanupInterval = setInterval(() => {
      cleanupExpiredWSTokens();
      cleanupExpiredOAuthStates();
    }, 60 * 1000); // 1 minute

    cleanupExpiredSessions().catch(() => { });
  }

  stop(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = null;
    }
    if (this.wsTokenCleanupInterval) {
      clearInterval(this.wsTokenCleanupInterval);
      this.wsTokenCleanupInterval = null;
    }
    if (this.server) {
      this.server.stop();
      this.server = null;
      this.logger.info("API server stopped");
    }
  }

 private async handleRequest(req: Request, url: URL): Promise<Response> {
    const path = url.pathname;
    const method = req.method;

    // Find matching route
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = path.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1]!;
        });

        try {
          const ctx: RouteContext = {
            req,
            params,
            query: url.searchParams,
            client: this.client,
            server: this,
            json: <T>() => req.json() as Promise<T>,
          };

          // Build middleware chain
          const allMiddleware = [...this.globalMiddleware, ...route.middleware];

          const executeHandler = async (): Promise<Response> => {
            return route.handler(ctx);
          };

          // Execute middleware chain
          let response: Response;
          if (allMiddleware.length === 0) {
            response = await executeHandler();
          } else {
            response = await this.executeMiddlewareChain(ctx, allMiddleware, executeHandler);
          }

          // Add CORS headers
          const headers = new Headers(response.headers);
          for (const [key, value] of Object.entries(this.corsHeaders(req))) {
            headers.set(key, value);
          }

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        } catch (error) {
          this.logger.error(`Request error: ${error}`);
          return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...this.corsHeaders(req),
            },
          });
        }
      }
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        ...this.corsHeaders(req),
      },
    });
  }

 private async executeMiddlewareChain(
    ctx: RouteContext,
    middleware: Middleware[],
    handler: () => Promise<Response>
  ): Promise<Response> {
    let index = 0;

    const next = async (): Promise<Response> => {
      if (index >= middleware.length) {
        return handler();
      }
      const mw = middleware[index++]!;
      return mw(ctx, next);
    };

    return next();
  }

 private async handleWSMessage(
    ws: ServerWebSocket<WebSocketData>,
    message: string | Buffer
  ): Promise<void> {
    try {
      const data = JSON.parse(message.toString()) as WSMessage;
      const handler = this.wsHandlers.get(data.type);

      if (handler) {
        const ctx: WSContext = {
          ws,
          data,
          client: this.client,
          server: this,
        };
        await handler(ctx);
      } else {
        ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${data.type}` }));
      }
    } catch (error) {
      this.logger.error(`WebSocket message error: ${error}`);
      ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
    }
  }

 broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
    for (const ws of this.connections) {
      ws.send(data);
    }
  }
 broadcastToGuild(guildId: string, message: WSMessage): void {
    const data = JSON.stringify(message);
    for (const ws of this.connections) {
      if (ws.data.guildId === guildId || ws.data.subscriptions.has(guildId)) {
        ws.send(data);
      }
    }
  }

 send(ws: ServerWebSocket<WebSocketData>, message: WSMessage): void {
    ws.send(JSON.stringify(message));
  }

 private corsHeaders(req?: Request): Record<string, string> {
    const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3000").split(",");
    const requestOrigin = req?.headers.get("Origin") ?? "";

    // Check if the request origin is in our allowed list
    const origin = allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0] ?? "http://localhost:3000";

    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    };
  }
}
