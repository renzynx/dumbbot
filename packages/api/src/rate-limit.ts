import { json } from "./response";
import type { Middleware } from "./types";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitConfig {
  /** Max requests per window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Custom key generator (default: IP address) */
  keyGenerator?: (req: Request) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
  /** Custom message when rate limited */
  message?: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  max: 100,
  windowMs: 60 * 1000, // 1 minute
  message: "Too many requests, please try again later",
};

const rateLimitStore = new Map<string, RateLimitEntry>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60 * 1000);
}

/**
 * Get client IP from request
 */
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  return "unknown";
}

/**
 * Create a rate limiter middleware with custom config
 */
export function rateLimit<TClient = unknown, TServer = unknown>(
  config: Partial<RateLimitConfig> = {}
): Middleware<TClient, TServer> {
  const opts = { ...DEFAULT_CONFIG, ...config };

  startCleanup();

  return async (ctx, next) => {
    if (opts.skip?.(ctx.req)) {
      return next();
    }

    const key = opts.keyGenerator?.(ctx.req) ?? getClientIP(ctx.req);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + opts.windowMs,
      };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, opts.max - entry.count);
    const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000);

    if (entry.count > opts.max) {
      return json(
        {
          error: "Too Many Requests",
          message: opts.message,
          retryAfter: resetInSeconds,
        },
        429,
        {
          "Retry-After": String(resetInSeconds),
          "X-RateLimit-Limit": String(opts.max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
        }
      );
    }

    const response = await next();

    const headers = new Headers(response.headers);
    headers.set("X-RateLimit-Limit", String(opts.max));
    headers.set("X-RateLimit-Remaining", String(remaining));
    headers.set("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Create common rate limit presets
 */
export function createRateLimitPresets<TClient = unknown, TServer = unknown>(
  getSessionToken?: (req: Request) => string | null
) {
  return {
    /** Stricter rate limit for auth endpoints - 10 req/min */
    auth: rateLimit<TClient, TServer>({
      max: 10,
      windowMs: 60 * 1000,
      message: "Too many authentication attempts, please try again later",
    }),

    /** Rate limit based on authenticated user (falls back to IP) - 100 req/min */
    user: rateLimit<TClient, TServer>({
      max: 100,
      windowMs: 60 * 1000,
      keyGenerator: (req) => {
        const token = getSessionToken?.(req);
        if (token) {
          return `user:${token}`;
        }
        return `ip:${getClientIP(req)}`;
      },
    }),

    /** Strict rate limit for expensive operations - 20 req/min */
    strict: rateLimit<TClient, TServer>({
      max: 20,
      windowMs: 60 * 1000,
      message: "Rate limit exceeded for this operation",
    }),

    /** Default global rate limit - 100 req/min */
    global: rateLimit<TClient, TServer>({
      max: 100,
      windowMs: 60 * 1000,
    }),
  };
}
