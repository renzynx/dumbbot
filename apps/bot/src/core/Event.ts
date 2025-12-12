import type { ClientEvents } from "discord.js";
import type { BotClient } from "@/core/Client";
import type { EventExecuteFunction, EventOptions } from "@/types";

/**
 * Base Event class - extend this to create event handlers
 */
export abstract class Event<K extends keyof ClientEvents = keyof ClientEvents> {
  public readonly name: K;
  public readonly once: boolean;
  public readonly enabled: boolean;

  protected readonly client: BotClient;

  constructor(client: BotClient, options: EventOptions<K>) {
    this.client = client;
    this.name = options.name;
    this.once = options.once ?? false;
    this.enabled = options.enabled ?? true;
  }

  /**
   * Execute the event handler
   * Must be implemented by subclasses
   */
  abstract execute(...args: ClientEvents[K]): Promise<void> | void;

  /**
   * Get the event options
   */
  getOptions(): EventOptions<K> {
    return {
      name: this.name,
      once: this.once,
      enabled: this.enabled,
    };
  }
}

/**
 * Factory function to create a simple event without extending the class
 */
export function createEvent<K extends keyof ClientEvents>(
  options: EventOptions<K> & {
    execute: EventExecuteFunction<K>;
  }
): new (client: BotClient) => Event<K> {
  return class extends Event<K> {
    private readonly executeFunction: EventExecuteFunction<K>;

    constructor(client: BotClient) {
      super(client, options);
      this.executeFunction = options.execute;
    }

    execute(...args: ClientEvents[K]): Promise<void> | void {
      return this.executeFunction(this.client, ...args);
    }
  };
}
