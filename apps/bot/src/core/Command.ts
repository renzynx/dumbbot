import {
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type PermissionResolvable,
} from "discord.js";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import type {
  AutocompleteFunction,
  CommandCategory,
  CommandExecuteFunction,
  CommandMeta,
  CommandOptions,
  SlashCommandBuilderType,
} from "@/types";
import { getCommandMetadata } from "@/decorators";

/**
 * Base Command class - extend this to create commands
 */
export abstract class Command {
  public readonly name: string;
  public readonly description: string;
  public readonly category: CommandCategory;
  public readonly aliases: string[];
  public readonly cooldown: number;
  public readonly permissions: PermissionResolvable[];
  public readonly botPermissions: PermissionResolvable[];
  public readonly ownerOnly: boolean;
  public readonly guildOnly: boolean;
  public readonly nsfw: boolean;
  public readonly defer: boolean;
  public readonly ephemeral: boolean;

  protected readonly client: BotClient;

  constructor(client: BotClient, options: Partial<CommandOptions> = {}) {
    this.client = client;

    // Merge decorator metadata with constructor options (options take precedence)
    // Decorators store metadata on the prototype, so we look it up there
    const decoratorMeta = getCommandMetadata(Object.getPrototypeOf(this));
    const merged = { ...decoratorMeta, ...options };

    this.name = merged.name ?? "unnamed";
    this.description = merged.description ?? "No description";
    this.category = merged.category ?? "general";
    this.aliases = merged.aliases ?? [];
    this.cooldown = merged.cooldown ?? 3;
    this.permissions = merged.permissions ?? [];
    this.botPermissions = merged.botPermissions ?? [];
    this.ownerOnly = merged.ownerOnly ?? false;
    this.guildOnly = merged.guildOnly ?? false;
    this.nsfw = merged.nsfw ?? false;
    this.defer = merged.defer ?? false;
    this.ephemeral = merged.ephemeral ?? false;
  }

  /**
   * Build the slash command data
   * Override this to add options, subcommands, etc.
   */
  build(): SlashCommandBuilderType {
    const builder = new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description);

    if (this.nsfw) {
      builder.setNSFW(true);
    }

    return builder;
  }

  /**
   * Execute the command
   * Must be implemented by subclasses
   */
  abstract execute(ctx: CommandContext): Promise<void> | void;

  /**
   * Handle autocomplete interactions
   * Override this for commands with autocomplete options
   */
  autocomplete?(
    interaction: AutocompleteInteraction,
    client: BotClient
  ): Promise<void> | void;

  /**
   * Get the command metadata
   */
  getMeta(): CommandMeta {
    return {
      name: this.name,
      description: this.description,
      category: this.category,
      aliases: this.aliases,
      cooldown: this.cooldown,
      permissions: this.permissions,
      botPermissions: this.botPermissions,
      ownerOnly: this.ownerOnly,
      guildOnly: this.guildOnly,
      nsfw: this.nsfw,
      defer: this.defer,
      ephemeral: this.ephemeral,
      builder: this.build(),
    };
  }

  /**
   * Check if a user can run this command
   */
  async canRun(ctx: CommandContext): Promise<{ allowed: boolean; reason?: string }> {
    // Owner only check
    if (this.ownerOnly && !ctx.isOwner()) {
      return { allowed: false, reason: "This command is owner only." };
    }

    // Guild only check
    if (this.guildOnly && !ctx.isGuild) {
      return { allowed: false, reason: "This command can only be used in a server." };
    }

    // NSFW check
    if (this.nsfw && ctx.channel && "nsfw" in ctx.channel && !ctx.channel.nsfw) {
      return { allowed: false, reason: "This command can only be used in NSFW channels." };
    }

    // User permissions check
    if (this.permissions.length > 0 && ctx.member) {
      const missing = this.permissions.filter(
        (perm) => !ctx.member!.permissions.has(perm)
      );
      if (missing.length > 0) {
        return {
          allowed: false,
          reason: `You are missing permissions: ${missing.join(", ")}`,
        };
      }
    }

    // Bot permissions check
    if (this.botPermissions.length > 0 && ctx.guild?.members.me) {
      const missing = this.botPermissions.filter(
        (perm) => !ctx.guild!.members.me!.permissions.has(perm)
      );
      if (missing.length > 0) {
        return {
          allowed: false,
          reason: `I am missing permissions: ${missing.join(", ")}`,
        };
      }
    }

    return { allowed: true };
  }
}

/**
 * Factory function to create a simple command without extending the class
 */
export function createCommand(
  options: CommandOptions & {
    build?: () => SlashCommandBuilderType;
    execute: CommandExecuteFunction;
    autocomplete?: AutocompleteFunction;
  }
): new (client: BotClient) => Command {
  return class extends Command {
    private readonly executeFunction: CommandExecuteFunction;
    private readonly buildFunction?: () => SlashCommandBuilderType;
    private readonly autocompleteFunction?: AutocompleteFunction;

    constructor(client: BotClient) {
      super(client, options);
      this.executeFunction = options.execute;
      this.buildFunction = options.build;
      this.autocompleteFunction = options.autocomplete;
    }

    override build(): SlashCommandBuilderType {
      if (this.buildFunction) {
        return this.buildFunction();
      }
      return super.build();
    }

    override execute(ctx: CommandContext): Promise<void> | void {
      return this.executeFunction(ctx);
    }

    override autocomplete(
      interaction: AutocompleteInteraction,
      client: BotClient
    ): Promise<void> | void {
      if (this.autocompleteFunction) {
        return this.autocompleteFunction(interaction, client);
      }
    }
  };
}
