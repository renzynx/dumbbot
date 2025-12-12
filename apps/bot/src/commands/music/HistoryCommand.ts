import { SlashCommandBuilder, EmbedBuilder  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";

@SlashCommand("history", "View recently played tracks")
@GuildOnly()
export class HistoryCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("Number of tracks to show (default: 10)")
          .setMinValue(1)
          .setMaxValue(50)
          .setRequired(false)
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
    if (!queue || queue.history.length === 0) {
      await ctx.reply({
        embeds: [ctx.info("No tracks in history yet. Start playing some music!")],
        ephemeral: true,
      });
      return;
    }

    const limit = ctx.interaction.options.getInteger("limit") ?? 10;
    const history = queue.getHistory(limit);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Recently Played")
      .setDescription(
        history
          .map((h, i) => {
            const timeAgo = this.formatTimeAgo(h.playedAt);
            return `**${i + 1}.** ${h.track.info.title}\n   └ ${h.track.info.author} • ${timeAgo}`;
          })
          .join("\n\n")
      )
      .setFooter({ text: `Showing ${history.length} of ${queue.history.length} tracks in history` });

    await ctx.reply({ embeds: [embed] });
  }

  private formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}
