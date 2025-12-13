import {
  Client,
  Collection,
  REST,
  Routes,
  Events,
  MessageFlags,
  type ClientEvents,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from "discord.js";
import { Glob } from "bun";
import type { BotClientOptions, CommandCategory, HookFunction, HookType, Middleware } from "@/types";
import { Command } from "@/core/Command";
import { CommandContext } from "@/core/Context";
import { Module } from "@/core/Module";
import { Event } from "@/core/Event";
import { Logger } from "@/utils/Logger";
import type { MusicManager } from "@/music/MusicManager";
import type { APIServer } from "@/api/server";

export class BotClient extends Client {
  public readonly botToken: string;
  public readonly clientId: string;
  public readonly prefix: string;
  public readonly ownerId: string[];
  public readonly debug: boolean;

  // Registries
  public readonly commands: Collection<string, Command> = new Collection();
  public readonly aliases: Collection<string, string> = new Collection();
  public readonly modules: Collection<string, Module> = new Collection();
  public readonly cooldowns: Collection<string, Collection<string, number>> =
    new Collection();

  // Music
  public music: MusicManager | null = null;

  // API Server (set after initialization)
  public apiServer: APIServer | null = null;

  // Middleware and hooks
  private readonly middlewares: Middleware[] = [];
  private readonly hooks: Map<HookType, HookFunction[]> = new Map();

  // Utilities
  public readonly logger: Logger;
  private readonly restClient: REST;

  constructor(options: BotClientOptions) {
    super(options);

    this.botToken = options.token;
    this.clientId = options.clientId;
    this.prefix = options.prefix ?? "!";
    this.ownerId = Array.isArray(options.ownerId)
      ? options.ownerId
      : options.ownerId
        ? [options.ownerId]
        : [];
    this.debug = options.debug ?? false;

    this.logger = new Logger("Bot", { level: this.debug ? "debug" : "info" });
    this.restClient = new REST({ version: "10" }).setToken(this.botToken);

    // Initialize hooks
    const hookTypes: HookType[] = [
      "beforeCommand",
      "afterCommand",
      "onError",
      "onCooldown",
      "onPermissionDenied",
    ];
    for (const hookType of hookTypes) {
      this.hooks.set(hookType, []);
    }

    this.setupCoreEvents();
  }

  // ==================== Core Event Handlers ====================

  private setupCoreEvents(): void {
    this.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction);
      } else if (interaction.isAutocomplete()) {
        await this.handleAutocomplete(interaction);
      }
    });

    // Error handling
    this.on(Events.Error, (error) => {
      this.logger.error("Client error:", error);
    });

    process.on("unhandledRejection", (error) => {
      this.logger.error("Unhandled rejection:", error);
    });
  }

  private async handleSlashCommand(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const command = this.commands.get(interaction.commandName);

    if (!command) {
      this.logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    const ctx = new CommandContext(this, interaction, command);

    try {
      // Check cooldown
      const cooldownResult = this.checkCooldown(
        interaction.user.id,
        command.name,
        command.cooldown
      );
      if (cooldownResult.onCooldown) {
        await this.runHooks("onCooldown", ctx);
        await interaction.reply({
          content: `Please wait ${cooldownResult.remaining?.toFixed(1)} seconds before using this command again.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Check permissions
      const permResult = await command.canRun(ctx);
      if (!permResult.allowed) {
        await this.runHooks("onPermissionDenied", ctx);
        await interaction.reply({
          content: permResult.reason ?? "You cannot use this command.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Auto-defer if configured
      if (command.defer) {
        await ctx.defer(command.ephemeral);
      }

      // Run middlewares
      await this.runMiddlewares(ctx, async () => {
        // Run beforeCommand hooks
        await this.runHooks("beforeCommand", ctx);

        // Execute command
        await command.execute(ctx);

        // Run afterCommand hooks
        await this.runHooks("afterCommand", ctx);
      });

      // Set cooldown
      this.setCooldown(interaction.user.id, command.name, command.cooldown);
    } catch (error) {
      this.logger.error(`Error executing command ${command.name}:`, error);
      await this.runHooks("onError", ctx, error as Error);

      const errorMessage = "An error occurred while executing this command.";
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
      }
    }
  }

  private async handleAutocomplete(
    interaction: AutocompleteInteraction
  ): Promise<void> {
    const command = this.commands.get(interaction.commandName);

    if (!command || !command.autocomplete) {
      return;
    }

    try {
      await command.autocomplete(interaction, this);
    } catch (error) {
      this.logger.error(`Autocomplete error for ${command.name}:`, error);
    }
  }

  // ==================== Cooldown Management ====================

  private checkCooldown(
    userId: string,
    commandName: string,
    cooldownSeconds: number
  ): { onCooldown: boolean; remaining?: number } {
    if (cooldownSeconds <= 0) {
      return { onCooldown: false };
    }

    // Owners bypass cooldowns
    if (this.isOwner(userId)) {
      return { onCooldown: false };
    }

    const now = Date.now();
    const cooldownAmount = cooldownSeconds * 1000;

    let commandCooldowns = this.cooldowns.get(commandName);
    if (!commandCooldowns) {
      commandCooldowns = new Collection();
      this.cooldowns.set(commandName, commandCooldowns);
    }

    const expirationTime = commandCooldowns.get(userId);
    if (expirationTime) {
      if (now < expirationTime) {
        const remaining = (expirationTime - now) / 1000;
        return { onCooldown: true, remaining };
      }
    }

    return { onCooldown: false };
  }

  private setCooldown(
    userId: string,
    commandName: string,
    cooldownSeconds: number
  ): void {
    if (cooldownSeconds <= 0 || this.isOwner(userId)) {
      return;
    }

    let commandCooldowns = this.cooldowns.get(commandName);
    if (!commandCooldowns) {
      commandCooldowns = new Collection();
      this.cooldowns.set(commandName, commandCooldowns);
    }

    commandCooldowns.set(userId, Date.now() + cooldownSeconds * 1000);

    // Cleanup after cooldown expires
    setTimeout(() => {
      commandCooldowns?.delete(userId);
    }, cooldownSeconds * 1000);
  }

  // ==================== Middleware System ====================

  /**
   * Add a middleware to the chain
   */
  public use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    this.middlewares.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.logger.debug(`Registered middleware: ${middleware.name}`);
    return this;
  }

  private async runMiddlewares(
    ctx: CommandContext,
    final: () => Promise<void>
  ): Promise<void> {
    const middlewares = [...this.middlewares];
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        if (middleware) {
          await middleware.execute(ctx, next);
        }
      } else {
        await final();
      }
    };

    await next();
  }

  // ==================== Hook System ====================

  /**
   * Register a hook for a specific event
   */
  public hook(type: HookType, handler: HookFunction): this {
    const handlers = this.hooks.get(type);
    if (handlers) {
      handlers.push(handler);
    }
    return this;
  }

  private async runHooks(
    type: HookType,
    ctx: CommandContext,
    error?: Error
  ): Promise<void> {
    const handlers = this.hooks.get(type);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        await handler(ctx, error);
      } catch (err) {
        this.logger.error(`Hook error (${type}):`, err);
      }
    }
  }

  // ==================== Module Management ====================

  /**
   * Load a module
   */
  public async loadModule(ModuleClass: new (client: BotClient) => Module): Promise<void> {
    const module = new ModuleClass(this);

    if (!module.enabled) {
      this.logger.debug(`Module ${module.name} is disabled, skipping`);
      return;
    }

    await module.onLoad();
    this.modules.set(module.name, module);
    this.logger.success(`Loaded module: ${module.name}`);
  }

  /**
   * Unload a module
   */
  public async unloadModule(name: string): Promise<boolean> {
    const module = this.modules.get(name);
    if (!module) {
      return false;
    }

    // Remove commands from this module
    for (const [commandName] of module.commands) {
      this.commands.delete(commandName);
    }

    await module.onUnload();
    this.modules.delete(name);
    this.logger.info(`Unloaded module: ${name}`);
    return true;
  }

  /**
   * Reload a module
   */
  public async reloadModule(
    name: string,
    ModuleClass: new (client: BotClient) => Module
  ): Promise<boolean> {
    await this.unloadModule(name);
    await this.loadModule(ModuleClass);
    return true;
  }

  // ==================== Command Registration ====================

  /**
   * Register slash commands with Discord
   */
  public async registerCommands(guildId?: string): Promise<void> {
    const commandData = this.commands.map((command) => {
      const builder = command.build();
      return builder.toJSON();
    });

    try {
      if (guildId) {
        await this.restClient.put(
          Routes.applicationGuildCommands(this.clientId, guildId),
          { body: commandData }
        );
        this.logger.success(`Registered ${commandData.length} commands to guild ${guildId}`);
      } else {
        await this.restClient.put(Routes.applicationCommands(this.clientId), {
          body: commandData,
        });
        this.logger.success(`Registered ${commandData.length} global commands`);
      }
    } catch (error) {
      this.logger.error("Failed to register commands:", error);
      throw error;
    }
  }

  /**
   * Register a single command
   */
  public registerCommand(CommandClass: new (client: BotClient) => Command): void {
    const command = new CommandClass(this);
    this.commands.set(command.name, command);

    for (const alias of command.aliases) {
      this.aliases.set(alias, command.name);
    }

    this.logger.debug(`Registered command: ${command.name}`);
  }

  /**
   * Auto-load all commands from a directory
   * Folder names become categories (e.g., commands/utility/ping.ts -> category: "utility")
   */
  public async loadCommands(dir: string): Promise<number> {
    const glob = new Glob("**/*.ts");
    let loaded = 0;

    for await (const file of glob.scan({ cwd: dir, absolute: true })) {
      try {
        const module = await import(file);
        const CommandClass = this.findCommandClass(module);

        if (!CommandClass) {
          this.logger.warn(`No Command class found in ${file}`);
          continue;
        }

        // Auto-detect category from folder structure
        const relativePath = file.replace(dir, "").replace(/^[\/\\]/, "");
        const parts = relativePath.split(/[\/\\]/);
        const category = parts.length > 1 ? parts[0] as CommandCategory : "general";

        const command = new CommandClass(this);
        
        // Override category if not explicitly set or is default
        if (command.category === "general" && category !== "general") {
          (command as { category: CommandCategory }).category = category;
        }

        this.commands.set(command.name, command);

        for (const alias of command.aliases) {
          this.aliases.set(alias, command.name);
        }

        this.logger.debug(`Loaded command: ${command.name} [${command.category}]`);
        loaded++;
      } catch (error) {
        this.logger.error(`Failed to load command from ${file}:`, error);
      }
    }

    this.logger.success(`Loaded ${loaded} commands from ${dir}`);
    return loaded;
  }

  /**
   * Find a Command class from module exports
   */
  private findCommandClass(
    module: Record<string, unknown>
  ): (new (client: BotClient) => Command) | null {
    for (const key of Object.keys(module)) {
      const exported = module[key];
      if (
        typeof exported === "function" &&
        exported.prototype instanceof Command
      ) {
        return exported as new (client: BotClient) => Command;
      }
    }
    return null;
  }

  // ==================== Event Management ====================

  /**
   * Register an event handler
   */
  public registerEvent<K extends keyof ClientEvents>(
    EventClass: new (client: BotClient) => Event<K>
  ): void {
    const event = new EventClass(this);

    if (!event.enabled) {
      this.logger.debug(`Event ${event.name} is disabled, skipping`);
      return;
    }

    const handler = (...args: ClientEvents[K]) => event.execute(...args);

    if (event.once) {
      this.once(event.name, handler);
    } else {
      this.on(event.name, handler);
    }

    this.logger.debug(`Registered event: ${event.name}`);
  }

  /**
   * Auto-load all events from a directory
   */
  public async loadEvents(dir: string): Promise<number> {
    const glob = new Glob("**/*.ts");
    let loaded = 0;

    for await (const file of glob.scan({ cwd: dir, absolute: true })) {
      try {
        const module = await import(file);
        const EventClass = this.findEventClass(module);

        if (!EventClass) {
          this.logger.warn(`No Event class found in ${file}`);
          continue;
        }

        const event = new EventClass(this);

        if (!event.enabled) {
          this.logger.debug(`Event ${event.name} is disabled, skipping`);
          continue;
        }

        const handler = (...args: unknown[]) => 
          (event.execute as (...args: unknown[]) => void)(...args);

        if (event.once) {
          this.once(event.name, handler);
        } else {
          this.on(event.name, handler);
        }

        this.logger.debug(`Loaded event: ${event.name}`);
        loaded++;
      } catch (error) {
        this.logger.error(`Failed to load event from ${file}:`, error);
      }
    }

    this.logger.success(`Loaded ${loaded} events from ${dir}`);
    return loaded;
  }

  /**
   * Find an Event class from module exports
   */
  private findEventClass(
    module: Record<string, unknown>
  ): (new (client: BotClient) => Event) | null {
    for (const key of Object.keys(module)) {
      const exported = module[key];
      if (
        typeof exported === "function" &&
        exported.prototype instanceof Event
      ) {
        return exported as new (client: BotClient) => Event;
      }
    }
    return null;
  }

  // ==================== Utility Methods ====================

  /**
   * Check if a user is a bot owner
   */
  public isOwner(userId: string): boolean {
    return this.ownerId.includes(userId);
  }

  /**
   * Start the bot
   */
  public async start(): Promise<void> {
    this.logger.info("Starting bot...");
    await this.login(this.botToken);
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    this.logger.info("Shutting down...");

    // Unload all modules
    for (const [name] of this.modules) {
      await this.unloadModule(name);
    }

    this.destroy();
    this.logger.success("Bot shut down gracefully");
  }

  /**
   * Get bot statistics
   */
  public getStats(): {
    guilds: number;
    users: number;
    commands: number;
    modules: number;
    uptime: number;
  } {
    return {
      guilds: this.guilds.cache.size,
      users: this.users.cache.size,
      commands: this.commands.size,
      modules: this.modules.size,
      uptime: this.uptime ?? 0,
    };
  }
}
