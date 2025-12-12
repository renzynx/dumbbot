import type { BotClient } from "@/core/Client";
import type { Command } from "@/core/Command";
import type { CommandCategory, CommandOptions } from "@/types";

// Metadata storage
const commandMetadata = new WeakMap<object, Partial<CommandOptions>>();

/**
 * Get stored metadata for a command class
 */
export function getCommandMetadata(target: object): Partial<CommandOptions> {
  return commandMetadata.get(target) ?? {};
}

/**
 * Set metadata for a command class
 */
function setCommandMetadata(
  target: object,
  key: keyof CommandOptions,
  value: unknown
): void {
  const existing = commandMetadata.get(target) ?? {};
  commandMetadata.set(target, { ...existing, [key]: value });
}

// ==================== Class Decorators ====================

/**
 * Define command name and description
 */
export function SlashCommand(name: string, description: string) {
  return function <T extends new (client: BotClient) => Command>(
    target: T
  ): T {
    setCommandMetadata(target.prototype, "name", name);
    setCommandMetadata(target.prototype, "description", description);
    return target;
  };
}

/**
 * Set command category
 */
export function Category(category: CommandCategory) {
  return function <T extends new (client: BotClient) => Command>(
    target: T
  ): T {
    setCommandMetadata(target.prototype, "category", category);
    return target;
  };
}

/**
 * Set command cooldown in seconds
 */
export function Cooldown(seconds: number) {
  return function <T extends new (client: BotClient) => Command>(
    target: T
  ): T {
    setCommandMetadata(target.prototype, "cooldown", seconds);
    return target;
  };
}

/**
 * Mark command as owner only
 */
export function OwnerOnly() {
  return function <T extends new (client: BotClient) => Command>(
    target: T
  ): T {
    setCommandMetadata(target.prototype, "ownerOnly", true);
    return target;
  };
}

/**
 * Mark command as guild only
 */
export function GuildOnly() {
  return function <T extends new (client: BotClient) => Command>(
    target: T
  ): T {
    setCommandMetadata(target.prototype, "guildOnly", true);
    return target;
  };
}

/**
 * Mark command as NSFW
 */
export function NSFW() {
  return function <T extends new (client: BotClient) => Command>(
    target: T
  ): T {
    setCommandMetadata(target.prototype, "nsfw", true);
    return target;
  };
}

/**
 * Auto-defer the command
 */
export function Defer(ephemeral: boolean = false) {
  return function <T extends new (client: BotClient) => Command>(
    target: T
  ): T {
    setCommandMetadata(target.prototype, "defer", true);
    setCommandMetadata(target.prototype, "ephemeral", ephemeral);
    return target;
  };
}

/**
 * Set required user permissions
 */
export function Permissions(...permissions: bigint[]) {
  return function <T extends new (client: BotClient) => Command>(
    target: T
  ): T {
    setCommandMetadata(target.prototype, "permissions", permissions);
    return target;
  };
}

/**
 * Set required bot permissions
 */
export function BotPermissions(...permissions: bigint[]) {
  return function <T extends new (client: BotClient) => Command>(
    target: T
  ): T {
    setCommandMetadata(target.prototype, "botPermissions", permissions);
    return target;
  };
}

/**
 * Set command aliases
 */
export function Aliases(...aliases: string[]) {
  return function <T extends new (client: BotClient) => Command>(
    target: T
  ): T {
    setCommandMetadata(target.prototype, "aliases", aliases);
    return target;
  };
}
