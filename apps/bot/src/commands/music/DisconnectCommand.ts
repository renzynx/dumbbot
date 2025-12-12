import { SlashCommandBuilder  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";

@SlashCommand("disconnect", "Disconnect the bot from voice")
@GuildOnly()
export class DisconnectCommand extends Command {
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
    if (!queue?.voiceChannelId) {
      await ctx.reply({
        embeds: [ctx.error("I'm not in a voice channel!")],
        ephemeral: true,
      });
      return;
    }

    await music.disconnect(ctx.guild!.id);
    await ctx.reply({
      embeds: [ctx.success("Disconnected from voice channel")],
    });
  }
}
