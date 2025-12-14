import { APIServer, json, redirect } from "@discordbot/api";
import type { BotClient } from "@/core/Client";
import { Logger } from "@/utils/Logger";
import {
  cleanupExpiredSessions,
  cleanupExpiredWSTokens,
  cleanupExpiredOAuthStates,
} from "@/db/sessions";
import type { WSHandler, Middleware } from "@/types/api";

// Re-export types for use by routes
export type { RouteContext, WSContext, WSHandler, Middleware } from "@/types/api";

// Re-export response helpers
export { json, redirect } from "@discordbot/api";

// Export BotAPIServer as APIServer for backward compatibility
export { BotAPIServer as APIServer };

/**
 * Custom logger adapter for the API server
 */
class APILogger {
  private logger = new Logger("API");

  debug(...args: unknown[]): void {
    const [first, ...rest] = args;
    this.logger.debug(String(first ?? ""), ...rest);
  }

  info(...args: unknown[]): void {
    const [first, ...rest] = args;
    this.logger.info(String(first ?? ""), ...rest);
  }

  success(...args: unknown[]): void {
    const [first, ...rest] = args;
    this.logger.success(String(first ?? ""), ...rest);
  }

  error(...args: unknown[]): void {
    const [first, ...rest] = args;
    this.logger.error(String(first ?? ""), ...rest);
  }
}

/**
 * Bot API Server - extends the base APIServer with bot-specific functionality
 */
export class BotAPIServer {
  private apiServer: APIServer<BotClient>;
  private sessionCleanupInterval: ReturnType<typeof setInterval> | null = null;
  private wsTokenCleanupInterval: ReturnType<typeof setInterval> | null = null;
  private logger = new Logger("API");

  public readonly client: BotClient;

  constructor(client: BotClient) {
    this.client = client;
    this.apiServer = new APIServer<BotClient>({
      client,
      logger: new APILogger(),
      routePrefix: "/api",
      allowedOrigins: process.env.FRONTEND_URL ?? "http://localhost:3000",
      wsPath: "/ws",
      wsIdleTimeout: 120,
    });
  }

  /**
   * Add global middleware
   */
  use(middleware: Middleware): this {
    this.apiServer.use(middleware as Parameters<typeof this.apiServer.use>[0]);
    return this;
  }

  /**
   * Load routes from a directory
   */
  async loadRoutes(routesDir: string): Promise<void> {
    await this.apiServer.loadRoutes(routesDir);
  }

  /**
   * Register WebSocket handlers
   */
  registerWSHandlers(handlers: Record<string, WSHandler>): this {
    this.apiServer.registerWSHandlers(
      handlers as Parameters<typeof this.apiServer.registerWSHandlers>[0]
    );
    return this;
  }

  /**
   * Start the server with session cleanup
   */
  start(port: number = 3001): void {
    this.apiServer.start(port);

    // Session cleanup every hour
    this.sessionCleanupInterval = setInterval(() => {
      cleanupExpiredSessions()
        .then(() => this.logger.debug("Session cleanup completed"))
        .catch((err) => this.logger.error("Session cleanup error:", err));
    }, 60 * 60 * 1000);

    // WS token and OAuth state cleanup every minute
    this.wsTokenCleanupInterval = setInterval(() => {
      cleanupExpiredWSTokens();
      cleanupExpiredOAuthStates();
    }, 60 * 1000);

    // Initial cleanup
    cleanupExpiredSessions().catch(() => {});
  }

  /**
   * Stop the server
   */
  stop(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = null;
    }
    if (this.wsTokenCleanupInterval) {
      clearInterval(this.wsTokenCleanupInterval);
      this.wsTokenCleanupInterval = null;
    }
    this.apiServer.stop();
  }

  /**
   * Broadcast to all connections
   */
  broadcast(message: { type: string; [key: string]: unknown }): void {
    this.apiServer.broadcast(message);
  }

  /**
   * Broadcast to guild subscribers
   */
  broadcastToGuild(guildId: string, message: { type: string; [key: string]: unknown }): void {
    this.apiServer.broadcastToGuild(guildId, message);
  }

  /**
   * Send to specific connection
   */
  send(
    ws: Parameters<typeof this.apiServer.send>[0],
    message: { type: string; [key: string]: unknown }
  ): void {
    this.apiServer.send(ws, message);
  }

  /**
   * Get all connections
   */
  getConnections() {
    return this.apiServer.getConnections();
  }
}
