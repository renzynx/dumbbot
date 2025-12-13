import { json, type Middleware } from "@/api/server";
import { getSessionToken } from "./auth";
import { Collection } from "discord.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
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

const rateLimitStore = new Collection<string, RateLimitEntry>();

// Cleanup expired entries periodically
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
  }, 60 * 1000); // Clean up every minute
}

/**
 * Get client IP from request
 */
function getClientIP(req: Request): string {
  // Check common proxy headers
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
export function rateLimit(config: Partial<RateLimitConfig> = {}): Middleware {
  const opts = { ...DEFAULT_CONFIG, ...config };
  
  // Start cleanup if not already running
  startCleanup();
  
  return async (ctx, next) => {
    // Check if should skip
    if (opts.skip?.(ctx.req)) {
      return next();
    }
    
    // Generate key for this request
    const key = opts.keyGenerator?.(ctx.req) ?? getClientIP(ctx.req);
    const now = Date.now();
    
    // Get or create entry
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetAt < now) {
      // Create new window
      entry = {
        count: 0,
        resetAt: now + opts.windowMs,
      };
      rateLimitStore.set(key, entry);
    }
    
    // Increment counter
    entry.count++;
    
    // Calculate remaining
    const remaining = Math.max(0, opts.max - entry.count);
    const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000);
    
    // Check if over limit
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
    
    // Continue with request
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
 * Stricter rate limit for auth endpoints
 */
export const authRateLimit = rateLimit({
  max: 10,
  windowMs: 60 * 1000, // 10 requests per minute
  message: "Too many authentication attempts, please try again later",
});

/**
 * Rate limit based on authenticated user (falls back to IP)
 */
export const userRateLimit = rateLimit({
  max: 100,
  windowMs: 60 * 1000,
  keyGenerator: (req) => {
    const token = getSessionToken(req);
    if (token) {
      return `user:${token}`;
    }
    return `ip:${getClientIP(req)}`;
  },
});

/**
 * Strict rate limit for expensive operations (search, etc)
 */
export const strictRateLimit = rateLimit({
  max: 20,
  windowMs: 60 * 1000,
  message: "Rate limit exceeded for this operation",
});

/**
 * Default global rate limit
 */
export const globalRateLimit = rateLimit({
  max: 100,
  windowMs: 60 * 1000,
});
