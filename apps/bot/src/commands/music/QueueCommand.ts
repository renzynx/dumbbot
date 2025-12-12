import { SlashCommandBuilder  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";

@SlashCommand("queue", "Show the current queue")
@GuildOnly()
export class QueueCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addIntegerOption((option) =>
        option
          .setName("page")
          .setDescription("Page number")
          .setMinValue(1)
      );
  }

  async execute(ctx: CommandContext): Promise<void> {
    const music = this.client.music;
    if (!music) {
      await ctx.reply({
        embeds: [ctx.error("Music system is not available!")],
        ephemeral: true,
      });
      return;
    }

    const queue = music.queues.get(ctx.guild!.id);
    if (!queue || (!queue.current && queue.isEmpty)) {
      await ctx.reply({
        embeds: [ctx.error("The queue is empty!")],
        ephemeral: true,
      });
      return;
    }

    const page = ctx.interaction.options.getInteger("page") ?? 1;
    const itemsPerPage = 10;
    const totalPages = Math.ceil(queue.size / itemsPerPage) || 1;
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, queue.size);

    let description = "";

    // Show current track
    if (queue.current) {
      const current = queue.current;
      description += `**Now Playing:**\n`;
      description += `[${current.track.info.title}](${current.track.info.uri}) - ${music.formatDuration(current.track.info.length)}\n`;
      description += `Requested by: ${current.requester}\n\n`;
    }

    // Show upcoming tracks
    if (queue.size > 0) {
      description += `**Up Next:**\n`;
      const tracks = queue.tracks.slice(startIndex, endIndex);
      
      for (let i = 0; i < tracks.length; i++) {
        const item = tracks[i]!;
        const position = startIndex + i + 1;
        description += `\`${position}.\` [${item.track.info.title}](${item.track.info.uri}) - ${music.formatDuration(item.track.info.length)}\n`;
      }
    }

    const embed = ctx
      .info(description || "No tracks in queue")
      .setTitle(`Queue for ${ctx.guild!.name}`)
      .setFooter({
        text: `Page ${currentPage}/${totalPages} | ${queue.size} track(s) | Total: ${music.formatDuration(queue.totalDuration)}`,
      });

    await ctx.reply({ embeds: [embed] });
  }
}
