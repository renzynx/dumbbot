import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  type APIEmbed,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type InteractionReplyOptions,
  type Message,
  type MessageCreateOptions,
  type MessageEditOptions,
  type MessagePayload,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type TextBasedChannel,
  type User,
} from "discord.js";
import type { BotClient } from "@/core/Client";
import type { Command } from "@/core/Command";

/**
 * Rich context object passed to command handlers
 * Provides convenient methods for replying, editing, and managing interactions
 */
export class CommandContext {
  public readonly client: BotClient;
  public readonly interaction: ChatInputCommandInteraction;
  public readonly command: Command;

  // Cached values for easy access
  public readonly user: User;
  public readonly member: GuildMember | null;
  public readonly guild: Guild | null;
  public readonly channel: TextBasedChannel | null;
  public readonly channelId: string;
  public readonly guildId: string | null;

  // State
  private _replied: boolean = false;
  private _deferred: boolean = false;

  constructor(
    client: BotClient,
    interaction: ChatInputCommandInteraction,
    command: Command
  ) {
    this.client = client;
    this.interaction = interaction;
    this.command = command;

    // Cache frequently accessed properties
    this.user = interaction.user;
    this.member = interaction.member as GuildMember | null;
    this.guild = interaction.guild;
    this.channel = interaction.channel;
    this.channelId = interaction.channelId;
    this.guildId = interaction.guildId;
  }

  // ==================== State Getters ====================

  get replied(): boolean {
    return this._replied || this.interaction.replied;
  }

  get deferred(): boolean {
    return this._deferred || this.interaction.deferred;
  }

  get isGuild(): boolean {
    return this.guild !== null;
  }

  // ==================== Option Helpers ====================

  /**
   * Get a string option value
   */
  getString(name: string, required?: boolean): string | null {
    return this.interaction.options.getString(name, required);
  }

  /**
   * Get an integer option value
   */
  getInteger(name: string, required?: boolean): number | null {
    return this.interaction.options.getInteger(name, required);
  }

  /**
   * Get a number option value
   */
  getNumber(name: string, required?: boolean): number | null {
    return this.interaction.options.getNumber(name, required);
  }

  /**
   * Get a boolean option value
   */
  getBoolean(name: string, required?: boolean): boolean | null {
    return this.interaction.options.getBoolean(name, required);
  }

  /**
   * Get a user option value
   */
  getUser(name: string, required?: boolean): User | null {
    return this.interaction.options.getUser(name, required);
  }

  /**
   * Get a member option value
   */
  getMember(name: string): GuildMember | null {
    return this.interaction.options.getMember(name) as GuildMember | null;
  }

  /**
   * Get a channel option value
   */
  getChannel(name: string, required?: boolean) {
    return this.interaction.options.getChannel(name, required);
  }

  /**
   * Get a role option value
   */
  getRole(name: string, required?: boolean) {
    return this.interaction.options.getRole(name, required);
  }

  /**
   * Get an attachment option value
   */
  getAttachment(name: string, required?: boolean) {
    return this.interaction.options.getAttachment(name, required);
  }

  /**
   * Get a mentionable option value
   */
  getMentionable(name: string, required?: boolean) {
    return this.interaction.options.getMentionable(name, required);
  }

  /**
   * Get the subcommand name
   */
  getSubcommand(required: boolean = false): string | null {
    try {
      return this.interaction.options.getSubcommand(required);
    } catch {
      return null;
    }
  }

  /**
   * Get the subcommand group name
   */
  getSubcommandGroup(required: boolean = false): string | null {
    try {
      return this.interaction.options.getSubcommandGroup(required);
    } catch {
      return null;
    }
  }

  // ==================== Reply Methods ====================

  /**
   * Defer the reply (show "thinking..." state)
   */
  async defer(ephemeral: boolean = false): Promise<void> {
    if (!this.deferred && !this.replied) {
      await this.interaction.deferReply({ 
        flags: ephemeral ? MessageFlags.Ephemeral : undefined 
      });
      this._deferred = true;
    }
  }

  /**
   * Reply to the interaction
   */
  async reply(
    options: string | InteractionReplyOptions
  ): Promise<Message> {
    const inputOpts = typeof options === "string" ? { content: options } : options;
    
    // Convert ephemeral to flags (create new object to avoid mutation)
    const { ephemeral, ...rest } = inputOpts as InteractionReplyOptions & { ephemeral?: boolean };
    const opts: InteractionReplyOptions = {
      ...rest,
      flags: ephemeral ? MessageFlags.Ephemeral : rest.flags,
    };

    if (this.deferred) {
      // When editing a deferred reply, strip incompatible flags
      const { content, embeds, components, files, allowedMentions } = opts;
      const result = await this.interaction.editReply({
        content,
        embeds,
        components,
        files,
        allowedMentions,
      });
      this._replied = true;
      return result;
    }

    if (this.replied) {
      return this.interaction.followUp(opts);
    }

    const response = await this.interaction.reply({
      ...opts,
      withResponse: true,
    });
    this._replied = true;
    return response.resource!.message!;
  }

  /**
   * Edit the original reply
   */
  async editReply(
    options: string | MessageEditOptions | MessagePayload
  ): Promise<Message> {
    return this.interaction.editReply(options);
  }

  /**
   * Delete the original reply
   */
  async deleteReply(): Promise<void> {
    await this.interaction.deleteReply();
  }

  /**
   * Send a follow-up message
   */
  async followUp(
    options: string | InteractionReplyOptions
  ): Promise<Message> {
    return this.interaction.followUp(options);
  }

  // ==================== Embed Helpers ====================

  /**
   * Reply with an embed
   */
  async embed(
    embed: EmbedBuilder | APIEmbed,
    ephemeral: boolean = false
  ): Promise<Message> {
    return this.reply({
      embeds: [embed instanceof EmbedBuilder ? embed.toJSON() : embed],
      flags: ephemeral ? MessageFlags.Ephemeral : undefined,
    });
  }

  /**
   * Create a success embed
   */
  success(message: string, title?: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(title ?? "Success")
      .setDescription(message)
      .setTimestamp();
  }

  /**
   * Create an error embed
   */
  error(message: string, title?: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(title ?? "Error")
      .setDescription(message)
      .setTimestamp();
  }

  /**
   * Create an info embed
   */
  info(message: string, title?: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(title ?? "Info")
      .setDescription(message)
      .setTimestamp();
  }

  /**
   * Create a warning embed
   */
  warn(message: string, title?: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(title ?? "Warning")
      .setDescription(message)
      .setTimestamp();
  }

  // ==================== Component Collectors ====================

  /**
   * Await a button interaction
   */
  async awaitButton(
    options: {
      filter?: (i: ButtonInteraction) => boolean;
      time?: number;
      message?: Message;
    } = {}
  ): Promise<ButtonInteraction | null> {
    const { filter, time = 60000, message } = options;
    const msg = message ?? (await this.interaction.fetchReply());

    try {
      return await msg.awaitMessageComponent({
        componentType: 2, // Button
        filter: filter
          ? (i) => filter(i as ButtonInteraction)
          : (i) => i.user.id === this.user.id,
        time,
      }) as ButtonInteraction;
    } catch {
      return null;
    }
  }

  /**
   * Await a select menu interaction
   */
  async awaitSelectMenu(
    options: {
      filter?: (i: StringSelectMenuInteraction) => boolean;
      time?: number;
      message?: Message;
    } = {}
  ): Promise<StringSelectMenuInteraction | null> {
    const { filter, time = 60000, message } = options;
    const msg = message ?? (await this.interaction.fetchReply());

    try {
      return await msg.awaitMessageComponent({
        componentType: 3, // SelectMenu
        filter: filter
          ? (i) => filter(i as StringSelectMenuInteraction)
          : (i) => i.user.id === this.user.id,
        time,
      }) as StringSelectMenuInteraction;
    } catch {
      return null;
    }
  }

  /**
   * Await a modal submission
   */
  async awaitModal(
    modal: ModalBuilder,
    options: { time?: number } = {}
  ): Promise<ModalSubmitInteraction | null> {
    const { time = 300000 } = options; // 5 minutes default

    await this.interaction.showModal(modal);

    try {
      return await this.interaction.awaitModalSubmit({
        filter: (i) =>
          i.user.id === this.user.id &&
          i.customId === modal.data.custom_id,
        time,
      });
    } catch {
      return null;
    }
  }

  // ==================== Utility Methods ====================

  /**
   * Send a message to the channel
   */
  async send(
    options: string | MessageCreateOptions
  ): Promise<Message | null> {
    if (!this.channel || !("send" in this.channel)) return null;
    const opts = typeof options === "string" ? { content: options } : options;
    return this.channel.send(opts);
  }

  /**
   * Check if the user has a permission
   */
  hasPermission(permission: bigint): boolean {
    if (!this.member) return false;
    return this.member.permissions.has(permission);
  }

  /**
   * Check if the bot has a permission in the guild
   */
  botHasPermission(permission: bigint): boolean {
    if (!this.guild?.members.me) return false;
    return this.guild.members.me.permissions.has(permission);
  }

  /**
   * Check if the user is a bot owner
   */
  isOwner(): boolean {
    return this.client.isOwner(this.user.id);
  }

  /**
   * Create a button row builder
   */
  createButtonRow(
    ...buttons: ButtonBuilder[]
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
  }

  /**
   * Create a select menu row builder
   */
  createSelectMenuRow(
    menu: StringSelectMenuBuilder
  ): ActionRowBuilder<StringSelectMenuBuilder> {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
  }
}
