import { GatewayIntentBits } from "discord.js";
import { join } from "node:path";
import { BotClient } from "./src/core/Client";
import { MusicManager } from "./src/music/MusicManager";
import { runMigrations } from "./src/db";
import type { CommandContext } from "./src/core/Context";
import { APIServer } from "./src/api/server";
import { createWSHandlers } from "./src/api/ws/handlers";

// Load environment variables
const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OWNER_ID = process.env.OWNER_ID;

// Lavalink configuration
const LAVALINK_HOST = process.env.LAVALINK_HOST ?? "localhost";
const LAVALINK_PORT = parseInt(process.env.LAVALINK_PORT ?? "2333", 10);
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD ?? "youshallnotpass";
const LAVALINK_SECURE = process.env.LAVALINK_SECURE === "true";

if (!TOKEN || !CLIENT_ID) {
  console.error("Missing BOT_TOKEN or CLIENT_ID in environment variables");
  process.exit(1);
}

// Create the bot client
const client = new BotClient({
  token: TOKEN,
  clientId: CLIENT_ID,
  ownerId: OWNER_ID,
  debug: process.env.NODE_ENV === "development",
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ==================== Auto-load Commands & Events ====================
const srcDir = join(import.meta.dir, "src");

// Load all commands from src/commands (auto-categorized by folder)
await client.loadCommands(join(srcDir, "commands"));

// Load all events from src/events
await client.loadEvents(join(srcDir, "events"));

client.use({
  name: "logging",
  priority: 100,
  execute: async (ctx: CommandContext, next: () => Promise<void>) => {
    const start = Date.now();
    client.logger.debug(`Command ${ctx.command.name} started by ${ctx.user.tag}`);

    await next();

    const duration = Date.now() - start;
    client.logger.debug(`Command ${ctx.command.name} completed in ${duration}ms`);
  },
});

client.hook("onError", async (ctx: CommandContext, error?: Error) => {
  client.logger.error(`Command ${ctx.command.name} failed:`, error?.message);
});

client.hook("onCooldown", async (ctx: CommandContext) => {
  client.logger.debug(`${ctx.user.tag} hit cooldown for ${ctx.command.name}`);
});

// ==================== Register Slash Commands & Start ====================
async function main() {
  try {
    // Run database migrations
    client.logger.info("Running database migrations...");
    runMigrations();
    client.logger.success("Database migrations complete");

    const GUILD_ID = process.env.GUILD_ID;
    await client.registerCommands(GUILD_ID);

    // Initialize MusicManager
    client.music = new MusicManager(client, {
      nodes: [
        {
          host: LAVALINK_HOST,
          port: LAVALINK_PORT,
          password: LAVALINK_PASSWORD,
          secure: LAVALINK_SECURE,
        },
      ],
      defaultVolume: 100,
      defaultSearchPlatform: "youtube",
    });

    // Start the bot
    await client.start();

    // Initialize music after bot is ready
    await client.music.initialize();
    client.logger.success("Music system initialized");

    const API_PORT = parseInt(process.env.API_PORT ?? "3001", 10);
    const apiServer = new APIServer(client);
    await apiServer.loadRoutes(join(srcDir, "api/routes"));
    apiServer.registerWSHandlers(createWSHandlers());
    apiServer.start(API_PORT);

    client.apiServer = apiServer;
  } catch (error) {
    client.logger.error("Failed to start bot:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await client.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await client.shutdown();
  process.exit(0);
});

main();
