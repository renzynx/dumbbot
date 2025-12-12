import { SlashCommandBuilder  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";

@SlashCommand("shuffle", "Shuffle the queue")
@GuildOnly()
export class ShuffleCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description);
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
    if (!queue || queue.size < 2) {
      await ctx.reply({
        embeds: [ctx.error("Not enough tracks to shuffle!")],
        ephemeral: true,
      });
      return;
    }

    music.shuffle(ctx.guild!.id);
    await ctx.reply({
      embeds: [ctx.success(`Shuffled **${queue.size}** tracks`)],
    });
  }
}
