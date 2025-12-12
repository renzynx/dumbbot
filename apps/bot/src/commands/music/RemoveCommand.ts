import { SlashCommandBuilder  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";

@SlashCommand("remove", "Remove a track from the queue")
@GuildOnly()
export class RemoveCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addIntegerOption((option) =>
        option
          .setName("position")
          .setDescription("Position of the track to remove (1-based)")
          .setMinValue(1)
          .setRequired(true)
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
    if (!queue || queue.size === 0) {
      await ctx.reply({
        embeds: [ctx.error("The queue is empty!")],
        ephemeral: true,
      });
      return;
    }

    const position = ctx.interaction.options.getInteger("position", true);
    const index = position - 1; // Convert to 0-based index

    if (index < 0 || index >= queue.size) {
      await ctx.reply({
        embeds: [ctx.error(`Invalid position! Please enter a number between 1 and ${queue.size}.`)],
        ephemeral: true,
      });
      return;
    }

    const removed = queue.remove(index);
    if (!removed) {
      await ctx.reply({
        embeds: [ctx.error("Failed to remove track.")],
        ephemeral: true,
      });
      return;
    }

    await ctx.reply({
      embeds: [ctx.success(`Removed **${removed.track.info.title}** from the queue.`)],
    });
  }
}
