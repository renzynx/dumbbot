import { Module } from "@/core/Module";
import type { BotClient } from "@/core/Client";

// Import commands
import { PingCommand } from "@/commands/utility/PingCommand";
import { HelpCommand } from "@/commands/utility/HelpCommand";
import { StatsCommand } from "@/commands/utility/StatsCommand";

/**
 * Core module containing essential commands
 */
export class CoreModule extends Module {
  constructor(client: BotClient) {
    super(client, {
      name: "core",
      description: "Core functionality and utility commands",
      enabled: true,
    });
  }

  onLoad(): void {
    // Register all core commands
    this.registerCommands(
      new PingCommand(this.client),
      new HelpCommand(this.client),
      new StatsCommand(this.client)
    );

    this.logger.info(
      `Loaded ${this.commands.size} commands`
    );
  }
}
