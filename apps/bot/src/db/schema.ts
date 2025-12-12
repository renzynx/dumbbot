import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * Playlists table - stores playlist metadata
 */
export const playlists = sqliteTable("playlists", {
  id: text("id").primaryKey(), // UUID
  guildId: text("guild_id").notNull(),
  ownerId: text("owner_id").notNull(),
  ownerName: text("owner_name").notNull(),
  name: text("name").notNull(),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

/**
 * Playlist tracks table - stores tracks in playlists
 */
export const playlistTracks = sqliteTable("playlist_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playlistId: text("playlist_id").notNull().references(() => playlists.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  encoded: text("encoded").notNull(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  uri: text("uri").notNull(),
  duration: integer("duration").notNull(),
  artworkUrl: text("artwork_url"),
});

/**
 * Guild settings table - stores per-guild music settings
 */
export const guildSettings = sqliteTable("guild_settings", {
  guildId: text("guild_id").primaryKey(),
  djRoleId: text("dj_role_id"),
  djOnlyMode: integer("dj_only_mode", { mode: "boolean" }).notNull().default(false),
  is247Mode: integer("is_247_mode", { mode: "boolean" }).notNull().default(false),
  autoplay: integer("autoplay", { mode: "boolean" }).notNull().default(false),
  voteSkipEnabled: integer("vote_skip_enabled", { mode: "boolean" }).notNull().default(false),
  voteSkipThreshold: real("vote_skip_threshold").notNull().default(0.5),
  defaultVolume: integer("default_volume").notNull().default(100),
});

/**
 * Accounts table - stores Discord user info and OAuth tokens (one per user)
 */
export const accounts = sqliteTable("accounts", {
  userId: text("user_id").primaryKey(), // Discord user ID
  username: text("username").notNull(),
  avatar: text("avatar"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: integer("token_expires_at").notNull(), // Discord token expiry (timestamp ms)
  guilds: text("guilds"), // JSON-serialized array of user's guilds
  guildsUpdatedAt: integer("guilds_updated_at", { mode: 'timestamp' }), // When guilds were last fetched (timestamp ms)
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

/**
 * Sessions table - stores user authentication sessions (many per account)
 */
export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(), // Session token (64 char hex string)
  accountId: text("account_id").notNull().references(() => accounts.userId, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  lastAccessedAt: integer("last_accessed_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Type exports
export type Playlist = typeof playlists.$inferSelect;
export type NewPlaylist = typeof playlists.$inferInsert;
export type PlaylistTrack = typeof playlistTracks.$inferSelect;
export type NewPlaylistTrack = typeof playlistTracks.$inferInsert;
export type GuildSettingsRow = typeof guildSettings.$inferSelect;
export type NewGuildSettings = typeof guildSettings.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
