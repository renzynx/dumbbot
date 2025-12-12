import { EmbedBuilder, SlashCommandBuilder, version as djsVersion } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, Cooldown } from "@/decorators";

@SlashCommand("stats", "Display bot statistics")
@Cooldown(10)
export class StatsCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description);
  }

  async execute(ctx: CommandContext): Promise<void> {
    const stats = ctx.client.getStats();
    const memUsage = process.memoryUsage();

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Bot Statistics")
      .setThumbnail(ctx.client.user?.displayAvatarURL() ?? null)
      .addFields(
        {
          name: "General",
          value: [
            `**Guilds:** ${stats.guilds}`,
            `**Users:** ${stats.users}`,
            `**Commands:** ${stats.commands}`,
            `**Modules:** ${stats.modules}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "System",
          value: [
            `**Uptime:** ${this.formatUptime(stats.uptime)}`,
            `**Memory:** ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            `**Node.js:** ${process.version}`,
            `**Discord.js:** v${djsVersion}`,
          ].join("\n"),
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: `Requested by ${ctx.user.tag}` });

    await ctx.reply({ embeds: [embed] });
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}
