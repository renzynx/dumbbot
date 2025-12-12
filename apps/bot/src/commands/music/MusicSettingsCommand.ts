import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly, Permissions } from "@/decorators";

@SlashCommand("musicsettings", "Configure music settings for this server")
@GuildOnly()
@Permissions(PermissionFlagsBits.ManageGuild)
export class MusicSettingsCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName("view")
          .setDescription("View current music settings")
      )
      .addSubcommand((sub) =>
        sub
          .setName("djrole")
          .setDescription("Set the DJ role")
          .addRoleOption((option) =>
            option
              .setName("role")
              .setDescription("The DJ role (leave empty to remove)")
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("djonly")
          .setDescription("Toggle DJ-only mode (only DJ role can use music commands)")
          .addBooleanOption((option) =>
            option
              .setName("enabled")
              .setDescription("Enable or disable DJ-only mode")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("247")
          .setDescription("Toggle 24/7 mode (stay connected when queue is empty)")
          .addBooleanOption((option) =>
            option
              .setName("enabled")
              .setDescription("Enable or disable 24/7 mode")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("autoplay")
          .setDescription("Toggle autoplay (queue similar tracks when queue ends)")
          .addBooleanOption((option) =>
            option
              .setName("enabled")
              .setDescription("Enable or disable autoplay")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("voteskip")
          .setDescription("Configure vote skip settings")
          .addBooleanOption((option) =>
            option
              .setName("enabled")
              .setDescription("Enable or disable vote skip")
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("percentage")
              .setDescription("Percentage of listeners required to skip (1-100)")
              .setMinValue(1)
              .setMaxValue(100)
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("defaultvolume")
          .setDescription("Set the default volume for new queues")
          .addIntegerOption((option) =>
            option
              .setName("volume")
              .setDescription("Volume (1-150)")
              .setMinValue(1)
              .setMaxValue(150)
              .setRequired(true)
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

    const subcommand = ctx.interaction.options.getSubcommand();
    const guildId = ctx.guild!.id;

    switch (subcommand) {
      case "view": {
        const settings = music.settings.get(guildId);
        const djRole = settings.djRoleId 
          ? ctx.guild!.roles.cache.get(settings.djRoleId)?.toString() ?? "Not found" 
          : "Not set";

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("Music Settings")
          .addFields(
            { name: "DJ Role", value: djRole, inline: true },
            { name: "DJ-Only Mode", value: settings.djOnlyMode ? "Enabled" : "Disabled", inline: true },
            { name: "24/7 Mode", value: settings.twentyFourSevenMode ? "Enabled" : "Disabled", inline: true },
            { name: "Autoplay", value: settings.autoplayEnabled ? "Enabled" : "Disabled", inline: true },
            { name: "Vote Skip", value: settings.voteSkipEnabled ? `Enabled (${settings.voteSkipPercentage}%)` : "Disabled", inline: true },
            { name: "Default Volume", value: `${settings.defaultVolume}%`, inline: true }
          );

        await ctx.reply({ embeds: [embed] });
        break;
      }

      case "djrole": {
        const role = ctx.interaction.options.getRole("role");
        music.settings.update(guildId, { djRoleId: role?.id ?? null });
        
        if (role) {
          await ctx.reply({
            embeds: [ctx.success(`DJ role set to ${role.toString()}`)],
          });
        } else {
          await ctx.reply({
            embeds: [ctx.success("DJ role removed")],
          });
        }
        break;
      }

      case "djonly": {
        const enabled = ctx.interaction.options.getBoolean("enabled", true);
        music.settings.update(guildId, { djOnlyMode: enabled });
        
        await ctx.reply({
          embeds: [ctx.success(`DJ-only mode ${enabled ? "enabled" : "disabled"}`)],
        });
        break;
      }

      case "247": {
        const enabled = ctx.interaction.options.getBoolean("enabled", true);
        music.settings.update(guildId, { twentyFourSevenMode: enabled });
        
        await ctx.reply({
          embeds: [ctx.success(`24/7 mode ${enabled ? "enabled" : "disabled"}. ${enabled ? "I will stay connected even when the queue is empty." : "I will disconnect after 30 seconds of inactivity."}`)],
        });
        break;
      }

      case "autoplay": {
        const enabled = ctx.interaction.options.getBoolean("enabled", true);
        music.settings.update(guildId, { autoplayEnabled: enabled });
        
        await ctx.reply({
          embeds: [ctx.success(`Autoplay ${enabled ? "enabled" : "disabled"}. ${enabled ? "I will queue similar tracks when the queue ends." : ""}`)],
        });
        break;
      }

      case "voteskip": {
        const enabled = ctx.interaction.options.getBoolean("enabled", true);
        const percentage = ctx.interaction.options.getInteger("percentage");
        
        const updates: { voteSkipEnabled: boolean; voteSkipPercentage?: number } = { 
          voteSkipEnabled: enabled 
        };
        
        if (percentage !== null) {
          updates.voteSkipPercentage = percentage;
        }
        
        music.settings.update(guildId, updates);
        
        const currentSettings = music.settings.get(guildId);
        await ctx.reply({
          embeds: [ctx.success(`Vote skip ${enabled ? `enabled (${currentSettings.voteSkipPercentage}% of listeners required)` : "disabled"}`)],
        });
        break;
      }

      case "defaultvolume": {
        const volume = ctx.interaction.options.getInteger("volume", true);
        music.settings.update(guildId, { defaultVolume: volume });
        
        await ctx.reply({
          embeds: [ctx.success(`Default volume set to ${volume}%`)],
        });
        break;
      }
    }
  }
}
