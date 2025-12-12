import { SlashCommandBuilder } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, Cooldown } from "@/decorators";

@SlashCommand("ping", "Check the bot's latency")
@Cooldown(5)
export class PingCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description);
  }

  async execute(ctx: CommandContext): Promise<void> {
    const sent = await ctx.reply("Pinging...");
    const roundTrip = sent.createdTimestamp - ctx.interaction.createdTimestamp;
    const wsLatency = ctx.client.ws.ping;

    await ctx.editReply({
      embeds: [
        ctx
          .info(`Roundtrip: **${roundTrip}ms**\nWebSocket: **${wsLatency}ms**`)
          .setTitle("Pong!")
          .setFooter({ text: `Requested by ${ctx.user.tag}` }),
      ],
    });
  }
}
