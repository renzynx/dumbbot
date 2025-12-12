/**
 * Discord Guild (server) representation
 * Used for caching guilds where the user has access
 */
export interface Guild {
  id: string;
  name: string;
  icon?: string | null;
  iconUrl?: string | null;
  banner?: string | null;
  owner: boolean;
  permissions: number | string;
  permissions_new?: string;
  features?: string[];
  hasBot?: boolean;
}

/**
 * Authenticated user information
 */
export interface User {
  id: string;
  username: string;
  avatar: string | null;
  avatarUrl: string;
  guilds?: Guild[];
}

/**
 * Auth user stored in session/context (internal use)
 */
export interface AuthUser {
  id: string;
  username: string;
  avatar: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
