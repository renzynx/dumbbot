import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  EmbedBuilder,
  MessageFlags,
  type Message,
  type ButtonInteraction,
} from "discord.js";
import type { BotClient } from "@/core/Client";
import type { Queue } from "./Queue.js";
import { formatDuration } from "@/utils/format";
import { Logger } from "@/utils/Logger";
import { LoopMode } from "@/types/music";

/**
 * Manages now playing messages and button interactions
 */
export class NowPlayingManager {
  private readonly client: BotClient;
  private readonly logger = new Logger("NowPlaying");
  private readonly messages = new Collection<string, Message>();

  constructor(client: BotClient) {
    this.client = client;
  }

  /**
   * Get the now playing message for a guild
   */
  getMessage(guildId: string): Message | undefined {
    return this.messages.get(guildId);
  }

  /**
   * Delete the now playing message for a guild
   */
  async deleteMessage(guildId: string): Promise<void> {
    const message = this.messages.get(guildId);
    if (message) {
      try {
        await message.delete();
      } catch {
        // Message might already be deleted
      }
      this.messages.delete(guildId);
    }
  }

  /**
   * Clear all messages (for cleanup)
   */
  clear(): void {
    this.messages.clear();
  }

  /**
   * Send now playing message with button controls
   */
  async sendNowPlaying(queue: Queue, isPaused: boolean): Promise<void> {
    if (!queue.current || !queue.textChannelId) return;

    try {
      const channel = await this.client.channels.fetch(queue.textChannelId);
      if (!channel?.isTextBased() || !("send" in channel)) return;

      // Delete previous now playing message
      await this.deleteMessage(queue.guildId);

      const { embed, components } = this.createNowPlayingEmbed(queue, isPaused);
      const message = await channel.send({ embeds: [embed], components });
      
      this.messages.set(queue.guildId, message);
    } catch (error) {
      this.logger.error("Failed to send now playing message:", error);
    }
  }

  /**
   * Update the now playing message with current state
   */
  async updateMessage(queue: Queue, isPaused: boolean): Promise<void> {
    const message = this.messages.get(queue.guildId);
    if (!message || !queue.current) return;

    try {
      const { embed, components } = this.createNowPlayingEmbed(queue, isPaused);
      await message.edit({ embeds: [embed], components });
    } catch {
      // Message might be deleted
      this.messages.delete(queue.guildId);
    }
  }

  /**
   * Create the now playing embed with buttons
   */
  createNowPlayingEmbed(queue: Queue, isPaused: boolean): { 
    embed: EmbedBuilder; 
    components: ActionRowBuilder<ButtonBuilder>[];
  } {
    const track = queue.current!.track;

    const embed = new EmbedBuilder()
      .setColor(isPaused ? 0xfee75c : 0x57f287)
      .setAuthor({ name: isPaused ? "Paused" : "Now Playing" })
      .setTitle(track.info.title)
      .setURL(track.info.uri ?? null)
      .setDescription(`By **${track.info.author || "Unknown"}**`)
      .addFields(
        {
          name: "Duration",
          value: formatDuration(track.info.length),
          inline: true,
        },
        {
          name: "Requested by",
          value: queue.current!.requester,
          inline: true,
        },
        {
          name: "Queue",
          value: `${queue.size} track${queue.size !== 1 ? "s" : ""}`,
          inline: true,
        }
      );

    if (track.info.artworkUrl) {
      embed.setThumbnail(track.info.artworkUrl);
    }

    // Add loop indicator
    if (queue.loopMode !== LoopMode.None) {
      const loopText = queue.loopMode === LoopMode.Track ? "🔂 Track" : "🔁 Queue";
      embed.setFooter({ text: `Loop: ${loopText}` });
    }

    // Create button rows
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("music_pause_resume")
        .setEmoji(isPaused ? "▶️" : "⏸️")
        .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music_skip")
        .setEmoji("⏭️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("music_stop")
        .setEmoji("⏹️")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("music_shuffle")
        .setEmoji("🔀")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("music_loop")
        .setEmoji(queue.loopMode === LoopMode.Track ? "🔂" : "🔁")
        .setStyle(queue.loopMode !== LoopMode.None ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("music_queue")
        .setLabel("View Queue")
        .setEmoji("📜")
        .setStyle(ButtonStyle.Secondary)
    );

    return { embed, components: [row1, row2] };
  }

  /**
   * Create queue embed with pagination
   */
  createQueueEmbed(
    queue: Queue,
    page: number
  ): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
    const itemsPerPage = 10;
    const totalPages = Math.max(1, Math.ceil(queue.size / itemsPerPage));
    const currentPage = Math.max(0, Math.min(page, totalPages - 1));
    
    const startIndex = currentPage * itemsPerPage;
    const tracks = queue.tracks.slice(startIndex, startIndex + itemsPerPage);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Queue")
      .setDescription(
        tracks.length > 0
          ? tracks
              .map((t, i) => `**${startIndex + i + 1}.** ${t.track.info.title} - ${t.track.info.author}`)
              .join("\n")
          : "No tracks in queue"
      )
      .setFooter({
        text: `Page ${currentPage + 1}/${totalPages} • ${queue.size} track${queue.size !== 1 ? "s" : ""} • Total: ${formatDuration(queue.totalDuration)}`,
      });

    if (queue.current) {
      embed.addFields({
        name: "Now Playing",
        value: `${queue.current.track.info.title} - ${queue.current.track.info.author}`,
      });
    }

    // Create pagination buttons
    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    
    if (totalPages > 1) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("music_queue_page_0")
          .setEmoji("⏮️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId(`music_queue_page_${currentPage - 1}`)
          .setEmoji("◀️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId("music_queue_page_current")
          .setLabel(`${currentPage + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`music_queue_page_${currentPage + 1}`)
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === totalPages - 1),
        new ButtonBuilder()
          .setCustomId(`music_queue_page_${totalPages - 1}`)
          .setEmoji("⏭️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === totalPages - 1)
      );
      components.push(row);
    }

    return { embed, components };
  }

  /**
   * Show a page of the queue
   */
  async showQueuePage(
    interaction: ButtonInteraction,
    queue: Queue,
    page: number
  ): Promise<void> {
    const { embed, components } = this.createQueueEmbed(queue, page);
    await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
  }

  /**
   * Handle queue pagination button
   */
  async handleQueuePagination(
    interaction: ButtonInteraction,
    queue: Queue,
    page: number
  ): Promise<void> {
    const { embed, components } = this.createQueueEmbed(queue, page);
    await interaction.update({ embeds: [embed], components });
  }
}
