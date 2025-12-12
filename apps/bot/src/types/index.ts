import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ClientEvents,
  ClientOptions,
  Guild,
  GuildMember,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  PermissionResolvable,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  TextBasedChannel,
  User,
} from "discord.js";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";

// ==================== Client Types ====================

export interface BotClientOptions extends ClientOptions {
  token: string;
  clientId: string;
  prefix?: string;
  ownerId?: string | string[];
  debug?: boolean;
}

// ==================== Command Types ====================

export type CommandCategory =
  | "general"
  | "moderation"
  | "fun"
  | "utility"
  | "admin"
  | "music"
  | "economy"
  | "custom";

export interface CommandOptions {
  name: string;
  description: string;
  category?: CommandCategory;
  aliases?: string[];
  cooldown?: number;
  permissions?: PermissionResolvable[];
  botPermissions?: PermissionResolvable[];
  ownerOnly?: boolean;
  guildOnly?: boolean;
  nsfw?: boolean;
  defer?: boolean;
  ephemeral?: boolean;
}

export type SlashCommandBuilderType =
  | SlashCommandBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandOptionsOnlyBuilder
  | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;

export interface CommandMeta extends CommandOptions {
  builder?: SlashCommandBuilderType;
}

export type CommandExecuteFunction = (
  ctx: CommandContext
) => Promise<void> | void;

export type AutocompleteFunction = (
  interaction: AutocompleteInteraction,
  client: BotClient
) => Promise<void> | void;

// ==================== Event Types ====================

export interface EventOptions<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  enabled?: boolean;
}

export type EventExecuteFunction<K extends keyof ClientEvents> = (
  client: BotClient,
  ...args: ClientEvents[K]
) => Promise<void> | void;

// ==================== Module Types ====================

export interface ModuleOptions {
  name: string;
  description?: string;
  enabled?: boolean;
}

export interface ModuleMeta extends ModuleOptions {
  commands: Map<string, CommandMeta>;
  events: Map<string, EventOptions>;
}

// ==================== Context Types ====================

export interface ContextData {
  client: BotClient;
  interaction: ChatInputCommandInteraction;
  user: User;
  member: GuildMember | null;
  guild: Guild | null;
  channel: TextBasedChannel | null;
}

// ==================== Component Types ====================

export interface ComponentHandlerOptions {
  customId: string | RegExp;
  timeout?: number;
}

export type ButtonHandler = (
  interaction: ButtonInteraction,
  client: BotClient
) => Promise<void> | void;

export type ModalHandler = (
  interaction: ModalSubmitInteraction,
  client: BotClient
) => Promise<void> | void;

export type ComponentHandler = (
  interaction: MessageComponentInteraction,
  client: BotClient
) => Promise<void> | void;

// ==================== Middleware Types ====================

export type MiddlewareFunction = (
  ctx: CommandContext,
  next: () => Promise<void>
) => Promise<void> | void;

export interface Middleware {
  name: string;
  priority?: number;
  execute: MiddlewareFunction;
}

// ==================== Hook Types ====================

export type HookType =
  | "beforeCommand"
  | "afterCommand"
  | "onError"
  | "onCooldown"
  | "onPermissionDenied";

export type HookFunction = (ctx: CommandContext, error?: Error) => Promise<void> | void;

// ==================== Store Types ====================

export interface CooldownEntry {
  userId: string;
  commandName: string;
  expiresAt: number;
}

// ==================== Logger Types ====================

export type LogLevel = "debug" | "info" | "warn" | "error" | "success";

export interface LoggerOptions {
  level?: LogLevel;
  timestamps?: boolean;
  colors?: boolean;
}

// ==================== Registry Types ====================

export interface Registry<T> {
  register(key: string, value: T): void;
  unregister(key: string): boolean;
  get(key: string): T | undefined;
  has(key: string): boolean;
  getAll(): Map<string, T>;
  clear(): void;
}

// ==================== Utility Types ====================

export type Constructor<T = object> = new (...args: unknown[]) => T;

export type Awaitable<T> = T | Promise<T>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
