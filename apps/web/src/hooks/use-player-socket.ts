"use client";

import { type SkipToken, skipToken } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { toast } from "sonner";
import { authApi, type GuildSettings, type PlayerState, type Track } from "@/lib/api";

export { skipToken };
export type { SkipToken };

// ==================== Types ====================

interface WSMessage {
  type: string;
  data?: unknown;
  message?: string;
  userId?: string;
}

interface PlayerUpdateData {
  playing: boolean;
  paused: boolean;
  current: Track | null;
  queue: Track[];
  position: number;
  volume: number;
  loopMode: number;
  settings: GuildSettings;
}

type LoopMode = "none" | "track" | "queue";

// ==================== State & Actions ====================

interface PlayerSocketState {
  player: PlayerState | null;
  interpolatedPosition: number;
  isConnected: boolean;
  error: string | null;
  isAddingTrack: boolean;
}

type PlayerAction =
  | { type: "SET_CONNECTED"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_PLAYER"; payload: PlayerState }
  | { type: "UPDATE_POSITION"; payload: number }
  | { type: "PARTIAL_UPDATE"; payload: Partial<PlayerState> }
  | { type: "OPTIMISTIC_PLAY" }
  | { type: "OPTIMISTIC_PAUSE" }
  | { type: "OPTIMISTIC_SEEK"; payload: number }
  | { type: "OPTIMISTIC_VOLUME"; payload: number }
  | { type: "OPTIMISTIC_LOOP"; payload: LoopMode }
  | { type: "OPTIMISTIC_REMOVE_TRACK"; payload: number }
  | { type: "OPTIMISTIC_MOVE_TRACK"; payload: { from: number; to: number } }
  | { type: "OPTIMISTIC_CLEAR_QUEUE" }
  | { type: "SET_ADDING_TRACK"; payload: boolean }
  | { type: "RESET" };

const initialState: PlayerSocketState = {
  player: null,
  interpolatedPosition: 0,
  isConnected: false,
  error: null,
  isAddingTrack: false,
};

function playerReducer(state: PlayerSocketState, action: PlayerAction): PlayerSocketState {
  switch (action.type) {
    case "SET_CONNECTED":
      return { ...state, isConnected: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SET_PLAYER":
      return { ...state, player: action.payload, interpolatedPosition: action.payload.position };

    case "UPDATE_POSITION":
      return { ...state, interpolatedPosition: action.payload };

    case "PARTIAL_UPDATE":
      return state.player
        ? { ...state, player: { ...state.player, ...action.payload } }
        : state;

    case "OPTIMISTIC_PLAY":
      return state.player
        ? { ...state, player: { ...state.player, paused: false, playing: true } }
        : state;

    case "OPTIMISTIC_PAUSE":
      return state.player
        ? { ...state, player: { ...state.player, paused: true } }
        : state;

    case "OPTIMISTIC_SEEK":
      return state.player
        ? { ...state, player: { ...state.player, position: action.payload }, interpolatedPosition: action.payload }
        : state;

    case "OPTIMISTIC_VOLUME":
      return state.player
        ? { ...state, player: { ...state.player, volume: action.payload } }
        : state;

    case "OPTIMISTIC_LOOP":
      return state.player
        ? { ...state, player: { ...state.player, loop: action.payload } }
        : state;

    case "OPTIMISTIC_REMOVE_TRACK": {
      if (!state.player) return state;
      const newQueue = [...state.player.queue];
      newQueue.splice(action.payload, 1);
      return { ...state, player: { ...state.player, queue: newQueue } };
    }

    case "OPTIMISTIC_MOVE_TRACK": {
      if (!state.player) return state;
      const newQueue = [...state.player.queue];
      const [removed] = newQueue.splice(action.payload.from, 1);
      if (removed) newQueue.splice(action.payload.to, 0, removed);
      return { ...state, player: { ...state.player, queue: newQueue } };
    }

    case "OPTIMISTIC_CLEAR_QUEUE":
      return state.player
        ? { ...state, player: { ...state.player, queue: [] } }
        : state;

    case "SET_ADDING_TRACK":
      return { ...state, isAddingTrack: action.payload };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// ==================== Constants ====================

const LOOP_MODE_MAP: Record<number, LoopMode> = {
  0: "none",
  1: "track",
  2: "queue",
};

const POSITION_UPDATE_INTERVAL = 100;
const OPTIMISTIC_UPDATE_DEBOUNCE = 1500;
const VOLUME_DEBOUNCE_MS = 100;
const SEEK_DEBOUNCE_MS = 100;

function getWebSocketUrl(): string {
  if (typeof window === "undefined") return "";
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (wsUrl) return wsUrl;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:3001/ws`;
}

// ==================== Debounce utility ====================

function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useMemo(() => {
    const debounced = ((...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T;
    return debounced;
  }, [delay]);
}

// ==================== Hook Return Type ====================

interface UsePlayerSocketReturn {
  // State
  state: PlayerState | null;
  interpolatedPosition: number;
  isConnected: boolean;
  error: string | null;
  isAddingTrack: boolean;

  // Connection
  reconnect: () => void;

  // Player actions (with built-in optimistic updates)
  actions: {
    play: () => void;
    pause: () => void;
    skip: () => void;
    stop: () => void;
    seek: (position: number) => void;
    setVolume: (volume: number) => void;
    toggleLoop: () => void;
    shuffle: () => void;
    addTrack: (query: string, username?: string) => void;
    removeTrack: (position: number) => void;
    moveTrack: (from: number, to: number) => void;
    playNext: (index: number) => void;
    clearQueue: () => void;
    applyFilter: (preset: string) => void;
    clearFilters: () => void;
  };
}

// ==================== Main Hook ====================

export function usePlayerSocket(
  guildIdOrSkipToken: string | SkipToken,
): UsePlayerSocketReturn {
  const [state, dispatch] = useReducer(playerReducer, initialState);

  const wsRef = useRef<WebSocket | null>(null);
  const lastServerPositionRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const lastOptimisticUpdateRef = useRef(0);
  const reconnectTriggerRef = useRef(0);
  const [, forceReconnect] = useReducer((x) => x + 1, 0);

  const enabled = guildIdOrSkipToken !== skipToken;
  const guildId = enabled ? guildIdOrSkipToken : "";

  // Mark optimistic update timestamp
  const markOptimistic = useCallback(() => {
    lastOptimisticUpdateRef.current = Date.now();
  }, []);

  // Send WebSocket message
  const send = useCallback((type: string, data?: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data }));
    }
  }, []);

  // Debounced send for volume (only sends the last value)
  const debouncedSendVolume = useDebouncedCallback((volume: number) => {
    send("volume", { volume });
  }, VOLUME_DEBOUNCE_MS);

  // Debounced send for seek
  const debouncedSendSeek = useDebouncedCallback((position: number) => {
    send("seek", { position });
  }, SEEK_DEBOUNCE_MS);

  // ==================== Actions with Optimistic Updates ====================

  const actions = {
    play: useCallback(() => {
      markOptimistic();
      dispatch({ type: "OPTIMISTIC_PLAY" });
      send("play");
    }, [markOptimistic, send]),

    pause: useCallback(() => {
      markOptimistic();
      dispatch({ type: "OPTIMISTIC_PAUSE" });
      send("pause");
    }, [markOptimistic, send]),

    skip: useCallback(() => {
      send("skip");
    }, [send]),

    stop: useCallback(() => {
      send("stop");
    }, [send]),

    seek: useCallback((position: number) => {
      markOptimistic();
      dispatch({ type: "OPTIMISTIC_SEEK", payload: position });
      lastServerPositionRef.current = position;
      lastUpdateTimeRef.current = Date.now();
      debouncedSendSeek(position);
    }, [markOptimistic, debouncedSendSeek]),

    setVolume: useCallback((volume: number) => {
      markOptimistic();
      dispatch({ type: "OPTIMISTIC_VOLUME", payload: volume });
      debouncedSendVolume(volume);
    }, [markOptimistic, debouncedSendVolume]),

    toggleLoop: useCallback(() => {
      const currentLoop = state.player?.loop ?? "none";
      const nextLoop: LoopMode =
        currentLoop === "none" ? "track" : currentLoop === "track" ? "queue" : "none";
      markOptimistic();
      dispatch({ type: "OPTIMISTIC_LOOP", payload: nextLoop });
      send("loop", { mode: nextLoop });
    }, [state.player?.loop, markOptimistic, send]),

    shuffle: useCallback(() => {
      send("shuffle");
      toast.success("Queue shuffled");
    }, [send]),

    addTrack: useCallback((query: string, username?: string) => {
      dispatch({ type: "SET_ADDING_TRACK", payload: true });
      send("addTrack", { query, username });
      toast.success("Adding track to queue...");
      setTimeout(() => dispatch({ type: "SET_ADDING_TRACK", payload: false }), 2000);
    }, [send]),

    removeTrack: useCallback((position: number) => {
      markOptimistic();
      dispatch({ type: "OPTIMISTIC_REMOVE_TRACK", payload: position });
      send("removeTrack", { position });
    }, [markOptimistic, send]),

    moveTrack: useCallback((from: number, to: number) => {
      markOptimistic();
      dispatch({ type: "OPTIMISTIC_MOVE_TRACK", payload: { from, to } });
      send("moveTrack", { from, to });
    }, [markOptimistic, send]),

    playNext: useCallback((index: number) => {
      if (index > 0) {
        markOptimistic();
        dispatch({ type: "OPTIMISTIC_MOVE_TRACK", payload: { from: index, to: 0 } });
        send("moveTrack", { from: index, to: 0 });
      }
    }, [markOptimistic, send]),

    clearQueue: useCallback(() => {
      markOptimistic();
      dispatch({ type: "OPTIMISTIC_CLEAR_QUEUE" });
      send("clearQueue");
      toast.success("Queue cleared");
    }, [markOptimistic, send]),

    applyFilter: useCallback((preset: string) => {
      send("applyFilter", { preset });
    }, [send]),

    clearFilters: useCallback(() => {
      send("clearFilters");
    }, [send]),
  };

  // ==================== Position Interpolation ====================

  useEffect(() => {
    if (!state.player?.playing || state.player?.paused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastUpdateTimeRef.current;
      const newPosition = lastServerPositionRef.current + elapsed;
      const duration = state.player?.current?.duration ?? 0;

      dispatch({
        type: "UPDATE_POSITION",
        payload: duration > 0 && newPosition >= duration ? duration : newPosition,
      });
    }, POSITION_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [state.player?.playing, state.player?.paused, state.player?.current?.duration]);

  // ==================== WebSocket Connection ====================

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const wsUrl = getWebSocketUrl();
    if (!wsUrl) return;

    let ws: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;

    const connect = async () => {
      if (!isMounted) return;

      // Fetch a short-lived WS auth token
      const { data: tokenData, error: tokenError } = await authApi.getWSToken();
      if (!isMounted) return;

      if (tokenError || !tokenData?.token) {
        dispatch({ type: "SET_ERROR", payload: "Failed to get auth token" });
        // Retry after delay
        reconnectTimeout = setTimeout(() => {
          if (isMounted) connect();
        }, 3000);
        return;
      }

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        // Authenticate first, then subscribe
        ws?.send(JSON.stringify({ type: "auth", token: tokenData.token }));
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const message: WSMessage = JSON.parse(event.data);

          switch (message.type) {
            case "authenticated":
              // Now subscribe to the guild
              dispatch({ type: "SET_CONNECTED", payload: true });
              dispatch({ type: "SET_ERROR", payload: null });
              ws?.send(JSON.stringify({ type: "subscribe", guildId }));

              pingInterval = setInterval(() => {
                if (ws?.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: "ping" }));
                }
              }, 30000);
              break;

            case "playerUpdate": {
              const data = message.data as PlayerUpdateData;
              const now = Date.now();

              // Sync position interpolation
              lastServerPositionRef.current = data.position;
              lastUpdateTimeRef.current = now;

              const timeSinceOptimistic = now - lastOptimisticUpdateRef.current;

              if (timeSinceOptimistic < OPTIMISTIC_UPDATE_DEBOUNCE) {
                // Only update position during optimistic debounce period
                dispatch({
                  type: "PARTIAL_UPDATE",
                  payload: { playing: data.playing, paused: data.paused, position: data.position },
                });
              } else {
                // Full state update
                dispatch({
                  type: "SET_PLAYER",
                  payload: {
                    guildId,
                    playing: data.playing,
                    paused: data.paused,
                    volume: data.volume,
                    position: data.position,
                    loop: LOOP_MODE_MAP[data.loopMode] ?? "none",
                    current: data.current,
                    queue: data.queue,
                    settings: data.settings,
                  },
                });
              }
              break;
            }

            case "error":
              dispatch({ type: "SET_ERROR", payload: message.message ?? "Unknown error" });
              toast.error(message.message ?? "An error occurred");
              break;

            case "success":
              // Could handle success toasts here if needed
              break;

            case "pong":
              break;
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onerror = () => {
        if (!isMounted) return;
        dispatch({ type: "SET_ERROR", payload: "WebSocket connection error" });
      };

      ws.onclose = () => {
        if (!isMounted) return;
        dispatch({ type: "SET_CONNECTED", payload: false });
        wsRef.current = null;

        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }

        reconnectTimeout = setTimeout(() => {
          if (isMounted) connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
      dispatch({ type: "RESET" });
    };
  }, [guildId, enabled, reconnectTriggerRef.current]);

  const reconnect = useCallback(() => {
    reconnectTriggerRef.current += 1;
    forceReconnect();
  }, []);

  return {
    state: state.player,
    interpolatedPosition: state.interpolatedPosition,
    isConnected: state.isConnected,
    error: state.error,
    isAddingTrack: state.isAddingTrack,
    reconnect,
    actions,
  };
}
