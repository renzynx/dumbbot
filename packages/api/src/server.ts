import type { ServerWebSocket } from "bun";
import { Glob } from "bun";
import { relative } from "node:path";
import type {
  APIServerOptions,
  CompiledRoute,
  Logger,
  Middleware,
  RouteContext,
  RouteModule,
  WebSocketData,
  WSContext,
  WSHandler,
  WSMessage,
} from "./types";
import { json } from "./response";

/**
 * Default console logger
 */
const defaultLogger: Logger = {
  debug: (...args) => console.debug("[API]", ...args),
  info: (...args) => console.info("[API]", ...args),
  success: (...args) => console.log("[API]", ...args),
  error: (...args) => console.error("[API]", ...args),
};

/**
 * Generic API Server with file-based routing and WebSocket support
 * @typeParam TClient - The client type passed to route handlers
 */
export class APIServer<TClient = unknown> {
  private server: ReturnType<typeof Bun.serve<WebSocketData>> | null = null;
  private routes: CompiledRoute<TClient, APIServer<TClient>>[] = [];
  private wsHandlers = new Map<string, WSHandler<TClient, APIServer<TClient>>>();
  private globalMiddleware: Middleware<TClient, APIServer<TClient>>[] = [];
  private logger: Logger;
  private routePrefix: string;
  private allowedOrigins: string[];
  private wsPath: string;
  private wsIdleTimeout: number;
  private connections: ServerWebSocket<WebSocketData>[] = [];

  public readonly client: TClient;

  constructor(options: APIServerOptions<TClient>) {
    this.client = options.client;
    this.logger = options.logger ?? defaultLogger;
    this.routePrefix = options.routePrefix ?? "/api";
    this.wsPath = options.wsPath ?? "/ws";
    this.wsIdleTimeout = options.wsIdleTimeout ?? 120;

    // Parse allowed origins
    if (Array.isArray(options.allowedOrigins)) {
      this.allowedOrigins = options.allowedOrigins;
    } else if (options.allowedOrigins) {
      this.allowedOrigins = options.allowedOrigins.split(",").map((o) => o.trim());
    } else {
      this.allowedOrigins = ["http://localhost:3000"];
    }
  }

  /**
   * Add global middleware
   */
  use(middleware: Middleware<TClient, APIServer<TClient>>): this {
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

    // Sort files to ensure consistent ordering (specific routes before dynamic)
    files.sort((a, b) => {
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
      const module = (await import(filePath)) as RouteModule<TClient, APIServer<TClient>>;
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
            handler: handler as CompiledRoute<TClient, APIServer<TClient>>["handler"],
            middleware: routeMiddleware as Middleware<TClient, APIServer<TClient>>[],
          });

          this.logger.debug(`  ${method} ${routePath}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to load route ${filePath}:`, error);
    }
  }

  /**
   * Convert file path to route path
   */
  private filePathToRoutePath(filePath: string): string {
    let route = filePath
      .replace(/\.ts$/, "") // Remove .ts extension
      .replace(/\\/g, "/") // Normalize path separators
      .replace(/\/index$/, "") // Remove /index suffix
      .replace(/\[([^\]]+)\]/g, ":$1"); // Convert [param] to :param

    return `${this.routePrefix}/${route}`;
  }

  /**
   * Compile a route path to a regex pattern
   */
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

  /**
   * Register WebSocket handlers
   */
  registerWSHandlers(handlers: Record<string, WSHandler<TClient, APIServer<TClient>>>): this {
    for (const [type, handler] of Object.entries(handlers)) {
      this.wsHandlers.set(type, handler);
      this.logger.debug(`Registered WS handler: ${type}`);
    }
    return this;
  }

  /**
   * Start the server
   */
  start(port: number = 3001): void {
    const self = this;

    this.server = Bun.serve<WebSocketData>({
      port,

      fetch(req, server) {
        const url = new URL(req.url);

        // Handle WebSocket upgrade
        if (url.pathname === self.wsPath) {
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
        idleTimeout: self.wsIdleTimeout,

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
  }

  /**
   * Stop the server
   */
  stop(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
      this.logger.info("API server stopped");
    }
  }

  /**
   * Handle incoming HTTP request
   */
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
          const ctx: RouteContext<TClient, APIServer<TClient>> = {
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

  /**
   * Execute middleware chain
   */
  private async executeMiddlewareChain(
    ctx: RouteContext<TClient, APIServer<TClient>>,
    middleware: Middleware<TClient, APIServer<TClient>>[],
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

  /**
   * Handle WebSocket message
   */
  private async handleWSMessage(
    ws: ServerWebSocket<WebSocketData>,
    message: string | Buffer
  ): Promise<void> {
    try {
      const data = JSON.parse(message.toString()) as WSMessage;
      const handler = this.wsHandlers.get(data.type);

      if (handler) {
        const ctx: WSContext<TClient, APIServer<TClient>> = {
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

  /**
   * Broadcast message to all connected WebSocket clients
   */
  broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
    for (const ws of this.connections) {
      ws.send(data);
    }
  }

  /**
   * Broadcast message to clients subscribed to a specific guild
   */
  broadcastToGuild(guildId: string, message: WSMessage): void {
    const data = JSON.stringify(message);
    for (const ws of this.connections) {
      if (ws.data.guildId === guildId || ws.data.subscriptions.has(guildId)) {
        ws.send(data);
      }
    }
  }

  /**
   * Send message to a specific WebSocket client
   */
  send(ws: ServerWebSocket<WebSocketData>, message: WSMessage): void {
    ws.send(JSON.stringify(message));
  }

  /**
   * Get CORS headers for a request
   */
  private corsHeaders(req?: Request): Record<string, string> {
    const requestOrigin = req?.headers.get("Origin") ?? "";

    // Check if the request origin is in our allowed list
    const origin = this.allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : this.allowedOrigins[0] ?? "http://localhost:3000";

    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    };
  }

  /**
   * Get all active WebSocket connections
   */
  getConnections(): ServerWebSocket<WebSocketData>[] {
    return this.connections;
  }
}
