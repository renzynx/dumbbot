import { SlashCommandBuilder  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";

@SlashCommand("pause", "Pause the current song")
@GuildOnly()
export class PauseCommand extends Command {
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
    if (!queue?.current) {
      await ctx.reply({
        embeds: [ctx.error("Nothing is playing!")],
        ephemeral: true,
      });
      return;
    }

    await music.pause(ctx.guild!.id);
    await ctx.reply({
      embeds: [ctx.success("Paused playback")],
    });
  }
}
