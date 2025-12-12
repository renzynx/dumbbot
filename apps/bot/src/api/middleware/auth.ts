import { json, type Middleware } from "@/api/server";
import {
  getSessionWithAccount,
  accountToAuthUser,
  updateAccountTokens,
  touchSession,
  getAccountGuilds,
  updateAccountGuilds,
  type Guild,
} from "@/db/sessions";

/**
 * Discord OAuth configuration
 */
export const DISCORD_CONFIG = {
  clientId: process.env.DISCORD_CLIENT_ID ?? process.env.CLIENT_ID ?? "",
  clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
  redirectUri: process.env.DISCORD_REDIRECT_URI ?? "http://localhost:3001/api/auth/callback",
  scopes: ["identify", "guilds"],
};

export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Parse session token from request
 */
export function getSessionToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check cookie
  const cookies = req.headers.get("Cookie");

  if (cookies) {
    const match = cookies.match(/session=([^;]+)/);
    if (match) {
      return match[1] ?? null;
    }
  }

  return null;
}

/**
 * Middleware to require authentication
 */
export const requireAuth: Middleware = async (ctx, next) => {
  const token = getSessionToken(ctx.req);

  if (!token) {
    return json({ error: "Unauthorized", message: "No session token provided" }, 401);
  }

  const result = await getSessionWithAccount(token);

  if (!result) {
    return json({ error: "Unauthorized", message: "Invalid or expired session" }, 401);
  }

  const { account } = result;
  const user = accountToAuthUser(account);

  // Check if Discord token is expired
  if (account.tokenExpiresAt < Date.now()) {
    const refreshed = await refreshDiscordToken(account.refreshToken);

    if (!refreshed) {
      return json({ error: "Unauthorized", message: "Session expired" }, 401);
    }

    // Update account tokens in database
    await updateAccountTokens(account.userId, refreshed);
    user.accessToken = refreshed.accessToken;
    user.refreshToken = refreshed.refreshToken;
    user.expiresAt = refreshed.expiresAt;
  } else {
    touchSession(token).catch(() => { });
  }

  ctx.user = user;
  return next();
};

export const optionalAuth: Middleware = async (ctx, next) => {
  const token = getSessionToken(ctx.req);

  if (token) {
    const result = await getSessionWithAccount(token);
    if (result && result.account.tokenExpiresAt > Date.now()) {
      ctx.user = accountToAuthUser(result.account);
      touchSession(token).catch(() => { });
    }
  }

  return next();
};


export const requireGuildAccess: Middleware = async (ctx, next) => {
  const token = getSessionToken(ctx.req);

  if (!token) {
    return json({ error: "Unauthorized" }, 401);
  }

  const result = await getSessionWithAccount(token);

  if (!result) {
    return json({ error: "Unauthorized" }, 401);
  }

  const { account } = result;
  const user = accountToAuthUser(account);

  // Check if Discord token is expired and refresh if needed
  if (account.tokenExpiresAt < Date.now()) {
    const refreshed = await refreshDiscordToken(account.refreshToken);

    if (!refreshed) {
      return json({ error: "Unauthorized", message: "Session expired" }, 401);
    }

    // Update account tokens in database
    await updateAccountTokens(account.userId, refreshed);
    user.accessToken = refreshed.accessToken;
    user.refreshToken = refreshed.refreshToken;
    user.expiresAt = refreshed.expiresAt;
  }

  ctx.user = user;

  // Check guild access
  const guildId = ctx.params.guildId;

  if (!guildId) {
    return json({ error: "Guild ID required" }, 400);
  }

  // Check if bot is in the guild first
  const botInGuild = ctx.client.guilds.cache.has(guildId);

  if (!botInGuild) {
    return json({ error: "Forbidden", message: "Bot is not in this guild" }, 403);
  }

  // Try to use cached guilds from account first (already filtered to common guilds)
  let guilds = getAccountGuilds(account);

  // If no cached guilds or cache expired, fetch from Discord and filter
  if (!guilds) {
    const fetchedGuilds = await fetchUserGuilds(user.accessToken);

    if (!fetchedGuilds) {
      return json({ error: "Failed to fetch user guilds" }, 500);
    }

    // Filter to only common guilds (where bot is present)
    const botGuildIds = new Set(ctx.client.guilds.cache.keys());
    guilds = filterCommonGuilds(fetchedGuilds, botGuildIds);

    // Cache only common guilds (fire and forget)
    updateAccountGuilds(account.userId, guilds).catch(() => { });
  }

  // Check if user has access to this guild
  const hasAccess = guilds.some((g: Guild) => g.id === guildId);

  if (!hasAccess) {
    return json({ error: "Forbidden", message: "You don't have access to this guild" }, 403);
  }

  touchSession(token).catch(() => { });

  return next();
};

/**
 * Discord OAuth token exchange
 */
export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null> {
  try {
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: DISCORD_CONFIG.clientId,
        client_secret: DISCORD_CONFIG.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: DISCORD_CONFIG.redirectUri,
      }),
    });

    if (!response.ok) {
      console.error("Token exchange failed:", await response.text());
      return null;
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  } catch (error) {
    console.error("Token exchange error:", error);
    return null;
  }
}

/**
 * Refresh Discord access token
 */
export async function refreshDiscordToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null> {
  try {
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: DISCORD_CONFIG.clientId,
        client_secret: DISCORD_CONFIG.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch Discord user info
 */
export async function fetchDiscordUser(accessToken: string): Promise<{
  id: string;
  username: string;
  avatar: string | null;
} | null> {
  try {
    const response = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<{
      id: string;
      username: string;
      avatar: string | null;
    }>;
  } catch {
    return null;
  }
}

/**
 * Fetch user's guilds
 */
export async function fetchUserGuilds(accessToken: string): Promise<Guild[] | null> {
  try {
    const response = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch guilds:", response.status, await response.text());
      return null;
    }

    return response.json() as Promise<Guild[]>;
  } catch (error) {
    console.error("Error fetching guilds:", error);
    return null;
  }
}

/**
 * Filter guilds to only include ones where the bot is present
 * Returns the intersection of user guilds and bot guilds
 */
export function filterCommonGuilds(
  userGuilds: Guild[],
  botGuildIds: Set<string>
): Guild[] {
  return userGuilds.filter((g) => botGuildIds.has(g.id));
}
