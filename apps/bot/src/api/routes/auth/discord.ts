import { redirect } from "@discordbot/api";
import type { RouteHandler, Middleware } from "@/types/api";
import { DISCORD_CONFIG } from "@/api/middleware/auth";
import { authRateLimit } from "@/api/middleware/rate-limit";
import { createOAuthState } from "@/db/sessions";

// Apply stricter rate limiting to auth endpoints
export const middleware: Middleware[] = [authRateLimit];

/**
 * GET /api/auth/discord
 * Redirects to Discord OAuth authorization page
 */
export const GET: RouteHandler = () => {
  const state = crypto.randomUUID();

  // Store state in memory for CSRF protection
  createOAuthState(state);

  const params = new URLSearchParams({
    client_id: DISCORD_CONFIG.clientId,
    redirect_uri: DISCORD_CONFIG.redirectUri,
    response_type: "code",
    scope: DISCORD_CONFIG.scopes.join(" "),
    state,
  });

  const authUrl = `https://discord.com/api/oauth2/authorize?${params}`;

  return redirect(authUrl);
};
