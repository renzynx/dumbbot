import type {
  LavalinkNodeOptions,
  LavalinkMessage,
  ReadyOp,
  LavalinkEvent,
  LavalinkStats,
  PlayerState,
} from "./types.js";

export type LavalinkSocketEvents = {
  ready: (data: ReadyOp) => void;
  playerUpdate: (guildId: string, state: PlayerState) => void;
  stats: (stats: LavalinkStats) => void;
  event: (event: LavalinkEvent) => void;
  trackStart: (event: LavalinkEvent & { type: "TrackStartEvent" }) => void;
  trackEnd: (event: LavalinkEvent & { type: "TrackEndEvent" }) => void;
  trackException: (event: LavalinkEvent & { type: "TrackExceptionEvent" }) => void;
  trackStuck: (event: LavalinkEvent & { type: "TrackStuckEvent" }) => void;
  websocketClosed: (event: LavalinkEvent & { type: "WebSocketClosedEvent" }) => void;
  open: () => void;
  close: (code: number, reason: string) => void;
  error: (error: Error) => void;
  raw: (message: LavalinkMessage) => void;
};

type EventCallback<K extends keyof LavalinkSocketEvents> = LavalinkSocketEvents[K];

/**
 * Lavalink WebSocket client
 * Handles the WebSocket connection and events from Lavalink
 */
export class LavalinkSocket {
  private readonly options: LavalinkNodeOptions;
  private socket: WebSocket | null = null;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Map<keyof LavalinkSocketEvents, Set<EventCallback<any>>>();

  constructor(options: LavalinkNodeOptions) {
    this.options = options;
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to the Lavalink server
   */
  connect(): void {
    if (this.socket) {
      this.socket.close();
    }

    const protocol = this.options.secure ? "wss" : "ws";
    const port = this.options.port ?? 2333;
    const url = `${protocol}://${this.options.host}:${port}/v4/websocket`;

    const headers: Record<string, string> = {
      Authorization: this.options.password,
      "User-Id": this.options.userId,
      "Client-Name": this.options.clientName ?? "lavalink-bun/1.0.0",
    };

    // Add session ID for resuming
    if (this.options.sessionId) {
      headers["Session-Id"] = this.options.sessionId;
    } else if (this.sessionId) {
      headers["Session-Id"] = this.sessionId;
    }

    // Bun's WebSocket supports headers in the constructor
    this.socket = new WebSocket(url, {
      // @ts-expect-error - Bun-specific WebSocket option
      headers,
    });

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit("open");
    };

    this.socket.onclose = (event) => {
      this.emit("close", event.code, event.reason);
      this.handleReconnect();
    };

    this.socket.onerror = () => {
      const error = new Error("WebSocket error");
      this.emit("error", error);
    };

    this.socket.onmessage = (event) => {
      this.handleMessage(event.data as string);
    };
  }

  /**
   * Disconnect from the Lavalink server
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      this.socket.close(1000, "Client disconnect");
      this.socket = null;
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    let message: LavalinkMessage;
    
    try {
      message = JSON.parse(data) as LavalinkMessage;
    } catch {
      return;
    }

    // Emit raw message for debugging
    this.emit("raw", message);

    switch (message.op) {
      case "ready":
        this.sessionId = message.sessionId;
        this.emit("ready", message);
        break;

      case "playerUpdate":
        this.emit("playerUpdate", message.guildId, message.state);
        break;

      case "stats":
        // Remove the 'op' field to get clean stats
        const { op, ...stats } = message;
        this.emit("stats", stats);
        break;

      case "event":
        this.emit("event", message as LavalinkEvent);
        this.handleEvent(message as LavalinkEvent);
        break;
    }
  }

  /**
   * Handle Lavalink events
   */
  private handleEvent(event: LavalinkEvent): void {
    switch (event.type) {
      case "TrackStartEvent":
        this.emit("trackStart", event);
        break;
      case "TrackEndEvent":
        this.emit("trackEnd", event);
        break;
      case "TrackExceptionEvent":
        this.emit("trackException", event);
        break;
      case "TrackStuckEvent":
        this.emit("trackStuck", event);
        break;
      case "WebSocketClosedEvent":
        this.emit("websocketClosed", event);
        break;
    }
  }

  /**
   * Handle reconnection
   */
  private handleReconnect(): void {
    const maxRetries = this.options.reconnect?.retries ?? 5;
    const delay = this.options.reconnect?.delay ?? 5000;

    if (this.reconnectAttempts >= maxRetries) {
      this.emit("error", new Error(`Failed to reconnect after ${maxRetries} attempts`));
      return;
    }

    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Add an event listener
   */
  on<K extends keyof LavalinkSocketEvents>(
    event: K,
    callback: EventCallback<K>
  ): this {
    let listeners = this.listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(event, listeners);
    }
    listeners.add(callback);
    return this;
  }

  /**
   * Add a one-time event listener
   */
  once<K extends keyof LavalinkSocketEvents>(
    event: K,
    callback: EventCallback<K>
  ): this {
    const onceCallback = ((...args: unknown[]) => {
      this.off(event, onceCallback as EventCallback<K>);
      (callback as (...args: unknown[]) => void)(...args);
    }) as EventCallback<K>;
    return this.on(event, onceCallback);
  }

  /**
   * Remove an event listener
   */
  off<K extends keyof LavalinkSocketEvents>(
    event: K,
    callback: EventCallback<K>
  ): this {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
    return this;
  }

  /**
   * Emit an event
   */
  private emit<K extends keyof LavalinkSocketEvents>(
    event: K,
    ...args: Parameters<LavalinkSocketEvents[K]>
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          (callback as (...args: unknown[]) => void)(...args);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      }
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: keyof LavalinkSocketEvents): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}
