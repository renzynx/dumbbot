import { json, type RouteHandler } from "@/api/server";
import {
  exchangeCode,
  fetchDiscordUser,
  fetchUserGuilds,
  filterCommonGuilds,
  generateSessionToken,
} from "@/api/middleware/auth";
import { createSession, upsertAccount, validateOAuthState } from "@/db/sessions";

/**
 * POST /api/auth/callback
 * Exchange OAuth code for session token
 */
export const POST: RouteHandler = async (ctx) => {
  const body = await ctx.json<{ code: string; state: string }>();

  if (!body.code || !body.state) {
    return json({ error: "Missing code or state" }, 400);
  }

  // Verify state (CSRF protection)
  const isValidState = validateOAuthState(body.state);
  if (!isValidState) {
    return json({ error: "Invalid or expired state" }, 400);
  }

  // Exchange code for tokens
  const tokens = await exchangeCode(body.code);
  if (!tokens) {
    return json({ error: "Failed to exchange authorization code" }, 500);
  }

  // Fetch user info
  const user = await fetchDiscordUser(tokens.accessToken);
  if (!user) {
    return json({ error: "Failed to fetch user info" }, 500);
  }

  // Fetch user's guilds and filter to only common guilds (where bot is also present)
  const allGuilds = await fetchUserGuilds(tokens.accessToken);
  const botGuildIds = new Set(ctx.client.guilds.cache.keys());
  const commonGuilds = allGuilds ? filterCommonGuilds(allGuilds, botGuildIds) : undefined;

  // Create or update account with only common guilds cached
  const account = await upsertAccount(
    {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    },
    commonGuilds
  );

  // Create a new session for this account
  const sessionToken = generateSessionToken();
  await createSession(sessionToken, account.userId);

  // Return session token in cookie
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  const isSecure = frontendUrl.startsWith("https");
  const cookieDomain = process.env.COOKIE_DOMAIN; // e.g., ".zotari.site" for cross-subdomain

  const cookieParts = [
    `session=${sessionToken}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${60 * 60 * 24 * 7}`,
    `SameSite=${isSecure ? "None" : "Lax"}`,
  ];

  if (isSecure) cookieParts.push("Secure");
  if (cookieDomain) cookieParts.push(`Domain=${cookieDomain}`);

  return new Response(
    JSON.stringify({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookieParts.join("; "),
      },
    }
  );
};
