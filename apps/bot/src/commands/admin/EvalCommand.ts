import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, Category, OwnerOnly } from "@/decorators";

@SlashCommand("eval", "Evaluate JavaScript code (owner only)")
@Category("admin")
@OwnerOnly()
export class EvalCommand extends Command {
  constructor(client: BotClient) {
    super(client, { cooldown: 0 });
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addStringOption((option) =>
        option
          .setName("code")
          .setDescription("The code to evaluate")
          .setRequired(true)
      )
      .addBooleanOption((option) =>
        option
          .setName("silent")
          .setDescription("Hide the output")
          .setRequired(false)
      );
  }

  async execute(ctx: CommandContext): Promise<void> {
    const code = ctx.getString("code");
    const silent = ctx.getBoolean("silent") ?? false;

    if (!code) {
      await ctx.reply({
        embeds: [ctx.error("Please provide code to evaluate.")],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      // Create a context for eval - these are available in the eval scope
      const evalContext = {
        client: ctx.client,
        interaction: ctx.interaction,
        guild: ctx.guild,
        channel: ctx.channel,
        user: ctx.user,
        member: ctx.member,
        ctx,
      };

      // Make context available
      const { client, interaction, guild, channel, user, member } = evalContext;
      
      // Silence unused variable warnings in eval context
      void client; void interaction; void guild; void channel; void user; void member;

      // eslint-disable-next-line no-eval
      let result = await eval(code);

      if (typeof result !== "string") {
        result = Bun.inspect(result, { depth: 2 });
      }

      // Truncate result if too long
      if (result.length > 1990) {
        result = result.slice(0, 1990) + "...";
      }

      if (!silent) {
        await ctx.reply({
          content: `\`\`\`js\n${result}\n\`\`\``,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await ctx.reply({
          content: "Executed silently.",
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await ctx.reply({
        embeds: [ctx.error(`\`\`\`js\n${errorMessage}\n\`\`\``, "Eval Error")],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
