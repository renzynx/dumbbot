"use client";

import { type SkipToken, skipToken } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GuildSettings, PlayerState, Track } from "@/lib/api";

export { skipToken };
export type { SkipToken };

// WebSocket message types
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
  loopMode: number; // 0 = none, 1 = track, 2 = queue
  settings: GuildSettings;
}

interface UsePlayerSocketReturn {
  state: PlayerState | null;
  /** Interpolated position that updates in real-time */
  interpolatedPosition: number;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
  optimisticUpdate: (
    updater: (prev: PlayerState | null) => PlayerState | null,
  ) => void;
}

const LOOP_MODE_MAP: Record<number, "none" | "track" | "queue"> = {
  0: "none",
  1: "track",
  2: "queue",
};

function getWebSocketUrl(): string {
  if (typeof window === "undefined") return "";

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (wsUrl) return wsUrl;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:3001/ws`;
}

// Position interpolation update interval (ms)
const POSITION_UPDATE_INTERVAL = 100;

// Duration to ignore server updates after an optimistic update (ms)
const OPTIMISTIC_UPDATE_DEBOUNCE = 1500;

export function usePlayerSocket(
  guildIdOrSkipToken: string | SkipToken,
): UsePlayerSocketReturn {
  const [state, setState] = useState<PlayerState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  // For position interpolation
  const [interpolatedPosition, setInterpolatedPosition] = useState(0);
  const lastServerPositionRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());

  // For optimistic update debouncing - ignore server updates briefly after optimistic update
  const lastOptimisticUpdateRef = useRef(0);

  const enabled = guildIdOrSkipToken !== skipToken;
  const guildId = enabled ? guildIdOrSkipToken : "";

  const optimisticUpdate = useCallback(
    (updater: (prev: PlayerState | null) => PlayerState | null) => {
      lastOptimisticUpdateRef.current = Date.now();
      setState(updater);
    },
    [],
  );

  const reconnect = useCallback(() => {
    setReconnectTrigger((n) => n + 1);
  }, []);

  // Position interpolation effect - updates position smoothly every 100ms
  useEffect(() => {
    if (!state?.playing || state?.paused) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastUpdateTimeRef.current;
      const newPosition = lastServerPositionRef.current + elapsed;

      // Don't exceed track duration
      const duration = state?.current?.duration ?? 0;
      if (duration > 0 && newPosition >= duration) {
        setInterpolatedPosition(duration);
      } else {
        setInterpolatedPosition(newPosition);
      }
    }, POSITION_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [state?.playing, state?.paused, state?.current?.duration]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const wsUrl = getWebSocketUrl();
    if (!wsUrl) return;

    let ws: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        setError(null);
        ws?.send(JSON.stringify({ type: "subscribe", guildId }));

        pingInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const message: WSMessage = JSON.parse(event.data);

          switch (message.type) {
            case "playerUpdate": {
              const data = message.data as PlayerUpdateData;
              const now = Date.now();

              // Sync position interpolation with server
              lastServerPositionRef.current = data.position;
              lastUpdateTimeRef.current = now;
              setInterpolatedPosition(data.position);

              // If we recently did an optimistic update, only update position-related fields
              // to prevent optimistic state from being reverted
              const timeSinceOptimisticUpdate =
                now - lastOptimisticUpdateRef.current;
              if (timeSinceOptimisticUpdate < OPTIMISTIC_UPDATE_DEBOUNCE) {
                // Preserve optimistic state (queue, current, loop, volume), only update position
                setState((prev) =>
                  prev
                    ? {
                        ...prev,
                        playing: data.playing,
                        paused: data.paused,
                        position: data.position,
                      }
                    : null,
                );
              } else {
                // No recent optimistic update, apply full server state
                setState({
                  guildId,
                  playing: data.playing,
                  paused: data.paused,
                  volume: data.volume,
                  position: data.position,
                  loop: LOOP_MODE_MAP[data.loopMode] ?? "none",
                  current: data.current,
                  queue: data.queue,
                  settings: data.settings,
                });
              }
              break;
            }

            case "error":
              setError(message.message ?? "Unknown error");
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
        setError("WebSocket connection error");
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setIsConnected(false);

        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }

        // Reconnect after delay
        reconnectTimeout = setTimeout(() => {
          if (isMounted) {
            connect();
          }
        }, 3000);
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null; // Prevent reconnect on cleanup
        ws.close();
      }
    };
  }, [guildId, enabled]);

  return {
    state,
    interpolatedPosition,
    isConnected,
    error,
    reconnect,
    optimisticUpdate,
  };
}
