import { eq, lt } from "drizzle-orm";
import { db } from "./index";
import { accounts, sessions, type Account, type Session } from "./schema";
import type { AuthUser, Guild } from "@discordbot/shared-types";

// Guild cache duration: 24 hour 
const GUILDS_CACHE_TTL = 24 * 60 * 60 * 1000;

export type { Guild } from "@discordbot/shared-types";

/**
 * Create or update an account (upsert on login)
 */
export async function upsertAccount(
  user: {
    id: string;
    username: string;
    avatar: string | null;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  },
  guilds?: Guild[]
): Promise<Account> {
  const existing = await getAccount(user.id);

  if (existing) {
    // Update existing account
    await db
      .update(accounts)
      .set({
        username: user.username,
        avatar: user.avatar,
        accessToken: user.accessToken,
        refreshToken: user.refreshToken,
        tokenExpiresAt: user.expiresAt,
        guilds: guilds ? JSON.stringify(guilds) : existing.guilds,
        guildsUpdatedAt: guilds ? new Date() : existing.guildsUpdatedAt,
        updatedAt: new Date(),
      })
      .where(eq(accounts.userId, user.id));

    return (await getAccount(user.id))!;
  }

  // Create new account
  await db.insert(accounts).values({
    userId: user.id,
    username: user.username,
    avatar: user.avatar,
    accessToken: user.accessToken,
    refreshToken: user.refreshToken,
    tokenExpiresAt: user.expiresAt,
  });

  return (await getAccount(user.id))!;
}

/**
 * Get an account by user ID
 */
export async function getAccount(userId: string): Promise<Account | null> {
  const result = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Get cached guilds from account if still valid
 */
export function getAccountGuilds(account: Account): Guild[] | null {
  if (!account.guilds || !account.guildsUpdatedAt) {
    return null;
  }

  // Check if cache is still valid
  if (Date.now() - account.guildsUpdatedAt.getTime() > GUILDS_CACHE_TTL) {
    return null;
  }

  try {
    return JSON.parse(account.guilds) as Guild[];
  } catch {
    return null;
  }
}

/**
 * Update account guilds cache
 */
export async function updateAccountGuilds(
  userId: string,
  guilds: Guild[]
): Promise<void> {
  await db
    .update(accounts)
    .set({
      guilds: JSON.stringify(guilds),
      guildsUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(accounts.userId, userId));
}

/**
 * Force refresh account guilds (clears cache timestamp)
 */
export async function invalidateAccountGuilds(userId: string): Promise<void> {
  await db
    .update(accounts)
    .set({
      guildsUpdatedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(accounts.userId, userId));
}

/**
 * Update account tokens after Discord token refresh
 */
export async function updateAccountTokens(
  userId: string,
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }
): Promise<void> {
  await db
    .update(accounts)
    .set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(accounts.userId, userId));
}

/**
 * Convert account to AuthUser format
 */
export function accountToAuthUser(account: Account): AuthUser {
  return {
    id: account.userId,
    username: account.username,
    avatar: account.avatar,
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
    expiresAt: account.tokenExpiresAt,
  };
}

/**
 * Delete an account and all its sessions
 */
export async function deleteAccount(userId: string): Promise<void> {
  // Sessions are deleted by cascade
  await db.delete(accounts).where(eq(accounts.userId, userId));
}

// ============================================
// Session Management
// ============================================

/**
 * Create a new session for an account
 */
export async function createSession(
  token: string,
  accountId: string
): Promise<void> {
  await db.insert(sessions).values({
    token,
    accountId,
  });
}

/**
 * Get a session by token
 */
export async function getSession(token: string): Promise<Session | null> {
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Get session with its associated account
 */
export async function getSessionWithAccount(
  token: string
): Promise<{ session: Session; account: Account } | null> {
  const result = await db
    .select()
    .from(sessions)
    .innerJoin(accounts, eq(sessions.accountId, accounts.userId))
    .where(eq(sessions.token, token))
    .limit(1);

  if (!result[0]) return null;

  return {
    session: result[0].sessions,
    account: result[0].accounts,
  };
}

/**
 * Update last accessed timestamp
 */
export async function touchSession(token: string): Promise<void> {
  await db
    .update(sessions)
    .set({ lastAccessedAt: new Date() })
    .where(eq(sessions.token, token));
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

/**
 * Delete all sessions for an account
 */
export async function deleteAccountSessions(accountId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.accountId, accountId));
}

/**
 * Clean up expired sessions (call periodically)
 * Sessions are considered expired if:
 * - Last accessed more than 30 days ago
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await db.delete(sessions).where(lt(sessions.lastAccessedAt, thirtyDaysAgo));
}

/**
 * Clean up accounts with expired tokens that haven't been accessed in 7 days
 */
export async function cleanupExpiredAccounts(): Promise<void> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  // Delete accounts where token expired more than 7 days ago
  await db.delete(accounts).where(lt(accounts.tokenExpiresAt, sevenDaysAgo));
}

// ============================================
// OAuth State Management 
// ============================================

const oauthStatesMap = new Map<string, number>();

/**
 * Create an OAuth state for CSRF protection
 * State expires after 10 minutes
 */
export function createOAuthState(state: string): void {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  oauthStatesMap.set(state, expiresAt);
}

/**
 * Validate and consume an OAuth state
 * Returns true if valid, false otherwise
 */
export function validateOAuthState(state: string): boolean {
  const expiresAt = oauthStatesMap.get(state);
  if (!expiresAt) return false;

  // Delete the state (one-time use)
  oauthStatesMap.delete(state);

  // Check if expired
  if (expiresAt < Date.now()) return false;

  return true;
}

/**
 * Clean up expired OAuth states 
 */
export function cleanupExpiredOAuthStates(): void {
  const now = Date.now();
  for (const [state, expiresAt] of oauthStatesMap) {
    if (expiresAt < now) {
      oauthStatesMap.delete(state);
    }
  }
}

// ============================================
// WebSocket Token Management
// ============================================

// Short-lived tokens for WebSocket authentication
// Map: token -> { userId, expiresAt }
const wsTokensMap = new Map<string, { userId: string; expiresAt: number }>();

// WS tokens expire after 30 seconds (just enough time to connect)
const WS_TOKEN_TTL = 30 * 1000;

/**
 * Generate a short-lived WebSocket authentication token
 */
export function createWSToken(userId: string): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  wsTokensMap.set(token, {
    userId,
    expiresAt: Date.now() + WS_TOKEN_TTL,
  });

  return token;
}

/**
 * Validate and consume a WebSocket token
 * Returns userId if valid, null otherwise
 */
export function validateWSToken(token: string): string | null {
  const data = wsTokensMap.get(token);
  if (!data) return null;

  // Delete the token (one-time use)
  wsTokensMap.delete(token);

  // Check if expired
  if (data.expiresAt < Date.now()) return null;

  return data.userId;
}

/**
 * Clean up expired WebSocket tokens
 */
export function cleanupExpiredWSTokens(): void {
  const now = Date.now();
  for (const [token, data] of wsTokensMap) {
    if (data.expiresAt < now) {
      wsTokensMap.delete(token);
    }
  }
}
