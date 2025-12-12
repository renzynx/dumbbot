import { SlashCommandBuilder  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";
import { LoopMode } from "@/music/MusicManager";

@SlashCommand("loop", "Set the loop mode")
@GuildOnly()
export class LoopCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addStringOption((option) =>
        option
          .setName("mode")
          .setDescription("Loop mode")
          .setRequired(true)
          .addChoices(
            { name: "Off", value: "none" },
            { name: "Track", value: "track" },
            { name: "Queue", value: "queue" }
          )
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
    if (!queue?.current) {
      await ctx.reply({
        embeds: [ctx.error("Nothing is playing!")],
        ephemeral: true,
      });
      return;
    }

    const mode = ctx.interaction.options.getString("mode", true) as LoopMode;
    music.setLoopMode(ctx.guild!.id, mode);

    const modeText = {
      [LoopMode.None]: "disabled",
      [LoopMode.Track]: "enabled for the current track 🔂",
      [LoopMode.Queue]: "enabled for the queue 🔁",
    };

    await ctx.reply({
      embeds: [ctx.success(`Loop ${modeText[mode]}`)],
    });
  }
}
