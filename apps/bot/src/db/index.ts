import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Database } from "bun:sqlite";
import * as schema from "./schema";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

// Ensure data directory exists
const dbPath = "data/bot.db";
const dataDir = dirname(dbPath);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Create or open database file
const sqlite = new Database(dbPath, { create: true });

// Enable WAL mode for better performance
sqlite.run("PRAGMA journal_mode = WAL;");
sqlite.run("PRAGMA foreign_keys = ON;");

// Create drizzle instance
export const db = drizzle(sqlite, { schema });

/**
 * Run database migrations
 * Call this on bot startup
 */
export function runMigrations(): void {
  try {
    migrate(db, { migrationsFolder: "./drizzle" });
  } catch { }
}

// Export for direct access if needed
export { sqlite };
