import { Collection } from "discord.js";
import type { BotClient } from "@/core/Client";
import type { Command } from "@/core/Command";
import type { Event } from "@/core/Event";
import type { ModuleOptions } from "@/types";
import { Logger } from "@/utils/Logger";

/**
 * Base Module class - extend this to create modular features
 * Modules group related commands and events together
 */
export abstract class Module {
  public readonly name: string;
  public readonly description: string;
  public readonly enabled: boolean;

  protected readonly client: BotClient;
  protected readonly logger: Logger;

  public readonly commands: Collection<string, Command> = new Collection();
  public readonly events: Collection<string, Event> = new Collection();

  constructor(client: BotClient, options: ModuleOptions) {
    this.client = client;
    this.name = options.name;
    this.description = options.description ?? "";
    this.enabled = options.enabled ?? true;
    this.logger = new Logger(`Module:${this.name}`);
  }

  /**
   * Called when the module is loaded
   * Override this to register commands and events
   */
  abstract onLoad(): Promise<void> | void;

  /**
   * Called when the module is unloaded
   * Override this to perform cleanup
   */
  onUnload(): Promise<void> | void {
    // Default implementation - clear commands and events
    this.commands.clear();
    this.events.clear();
  }

  /**
   * Register a command to this module
   */
  protected registerCommand(command: Command): void {
    this.commands.set(command.name, command);
    this.client.commands.set(command.name, command);

    // Register aliases
    for (const alias of command.aliases) {
      this.client.aliases.set(alias, command.name);
    }

    this.logger.debug(`Registered command: ${command.name}`);
  }

  /**
   * Register multiple commands
   */
  protected registerCommands(...commands: Command[]): void {
    for (const command of commands) {
      this.registerCommand(command);
    }
  }

  /**
   * Register an event to this module
   */
  protected registerEvent(event: Event): void {
    if (!event.enabled) return;

    const eventKey = `${event.name}-${this.name}`;
    this.events.set(eventKey, event);

    const handler = (...args: unknown[]) => {
      (event.execute as (...args: unknown[]) => void)(...args);
    };

    if (event.once) {
      this.client.once(event.name, handler);
    } else {
      this.client.on(event.name, handler);
    }

    this.logger.debug(`Registered event: ${event.name}`);
  }

  /**
   * Register multiple events
   */
  protected registerEvents(...events: Event[]): void {
    for (const event of events) {
      this.registerEvent(event);
    }
  }

  /**
   * Get module info
   */
  getInfo(): ModuleOptions & {
    commandCount: number;
    eventCount: number;
  } {
    return {
      name: this.name,
      description: this.description,
      enabled: this.enabled,
      commandCount: this.commands.size,
      eventCount: this.events.size,
    };
  }
}

/**
 * Factory function to create a simple module
 */
export function createModule(
  options: ModuleOptions & {
    onLoad: (module: Module, client: BotClient) => Promise<void> | void;
    onUnload?: (module: Module, client: BotClient) => Promise<void> | void;
  }
): new (client: BotClient) => Module {
  return class extends Module {
    private readonly onLoadFunction: (
      module: Module,
      client: BotClient
    ) => Promise<void> | void;
    private readonly onUnloadFunction?: (
      module: Module,
      client: BotClient
    ) => Promise<void> | void;

    constructor(client: BotClient) {
      super(client, options);
      this.onLoadFunction = options.onLoad;
      this.onUnloadFunction = options.onUnload;
    }

    override async onLoad(): Promise<void> {
      await this.onLoadFunction(this, this.client);
    }

    override async onUnload(): Promise<void> {
      if (this.onUnloadFunction) {
        await this.onUnloadFunction(this, this.client);
      }
      super.onUnload();
    }
  };
}
