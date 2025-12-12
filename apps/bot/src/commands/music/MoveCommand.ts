import { SlashCommandBuilder  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";

@SlashCommand("move", "Move a track to a different position in the queue")
@GuildOnly()
export class MoveCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addIntegerOption((option) =>
        option
          .setName("from")
          .setDescription("Current position of the track (1-based)")
          .setMinValue(1)
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("to")
          .setDescription("New position for the track (1-based)")
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

    const from = ctx.interaction.options.getInteger("from", true);
    const to = ctx.interaction.options.getInteger("to", true);

    const fromIndex = from - 1;
    const toIndex = to - 1;

    if (fromIndex < 0 || fromIndex >= queue.size) {
      await ctx.reply({
        embeds: [ctx.error(`Invalid 'from' position! Please enter a number between 1 and ${queue.size}.`)],
        ephemeral: true,
      });
      return;
    }

    if (toIndex < 0 || toIndex >= queue.size) {
      await ctx.reply({
        embeds: [ctx.error(`Invalid 'to' position! Please enter a number between 1 and ${queue.size}.`)],
        ephemeral: true,
      });
      return;
    }

    if (fromIndex === toIndex) {
      await ctx.reply({
        embeds: [ctx.info("Track is already in that position.")],
        ephemeral: true,
      });
      return;
    }

    const track = queue.tracks[fromIndex];
    const success = queue.move(fromIndex, toIndex);

    if (!success || !track) {
      await ctx.reply({
        embeds: [ctx.error("Failed to move track.")],
        ephemeral: true,
      });
      return;
    }

    await ctx.reply({
      embeds: [ctx.success(`Moved **${track.track.info.title}** from position ${from} to ${to}.`)],
    });
  }
}
