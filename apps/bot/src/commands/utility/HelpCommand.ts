import { EmbedBuilder, MessageFlags, SlashCommandBuilder, type EmbedField } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, Cooldown } from "@/decorators";

@SlashCommand("help", "Display available commands")
@Cooldown(5)
export class HelpCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addStringOption((option) =>
        option
          .setName("command")
          .setDescription("Get detailed info about a specific command")
          .setRequired(false)
      );
  }

  async execute(ctx: CommandContext): Promise<void> {
    const commandName = ctx.getString("command");

    if (commandName) {
      await this.showCommandHelp(ctx, commandName);
    } else {
      await this.showAllCommands(ctx);
    }
  }

  private async showCommandHelp(
    ctx: CommandContext,
    commandName: string
  ): Promise<void> {
    const command = ctx.client.commands.get(commandName);

    if (!command) {
      await ctx.reply({
        embeds: [ctx.error(`Command \`${commandName}\` not found.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Command: ${command.name}`)
      .setDescription(command.description)
      .addFields(
        { name: "Category", value: command.category, inline: true },
        { name: "Cooldown", value: `${command.cooldown}s`, inline: true },
        {
          name: "Guild Only",
          value: command.guildOnly ? "Yes" : "No",
          inline: true,
        },
        {
          name: "Owner Only",
          value: command.ownerOnly ? "Yes" : "No",
          inline: true,
        }
      )
      .setTimestamp();

    if (command.aliases.length > 0) {
      embed.addFields({
        name: "Aliases",
        value: command.aliases.map((a) => `\`${a}\``).join(", "),
      });
    }

    await ctx.reply({ embeds: [embed] });
  }

  private async showAllCommands(ctx: CommandContext): Promise<void> {
    const commands = ctx.client.commands;
    const categories = new Map<string, string[]>();

    // Group commands by category
    for (const [, command] of commands) {
      const category = command.category;
      const existing = categories.get(category) ?? [];
      existing.push(command.name);
      categories.set(category, existing);
    }

    const fields: EmbedField[] = [];
    for (const [category, cmds] of categories) {
      fields.push({
        name: category.charAt(0).toUpperCase() + category.slice(1),
        value: cmds.map((c) => `\`${c}\``).join(", "),
        inline: false,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Available Commands")
      .setDescription("Use `/help <command>` for detailed information")
      .addFields(fields)
      .setFooter({
        text: `Total: ${commands.size} commands`,
      })
      .setTimestamp();

    await ctx.reply({ embeds: [embed] });
  }
}
