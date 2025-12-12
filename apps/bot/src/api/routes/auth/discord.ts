import { redirect, type RouteHandler } from "@/api/server";
import { DISCORD_CONFIG } from "@/api/middleware/auth";
import { createOAuthState } from "@/db/sessions";

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
