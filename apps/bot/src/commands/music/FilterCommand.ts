import { SlashCommandBuilder, EmbedBuilder  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";
import type { Filters } from "@discordbot/lavalink";

/**
 * Preset filter configurations
 */
const FILTER_PRESETS: Record<string, { name: string; description: string; filters: Filters }> = {
  nightcore: {
    name: "Nightcore",
    description: "Higher pitch and faster tempo",
    filters: {
      timescale: {
        speed: 1.25,
        pitch: 1.3,
        rate: 1.0,
      },
    },
  },
  vaporwave: {
    name: "Vaporwave",
    description: "Slowed down with lower pitch",
    filters: {
      timescale: {
        speed: 0.85,
        pitch: 0.8,
        rate: 1.0,
      },
    },
  },
  bass: {
    name: "Bass Boost",
    description: "Enhanced bass frequencies",
    filters: {
      equalizer: [
        { band: 0, gain: 0.6 },
        { band: 1, gain: 0.5 },
        { band: 2, gain: 0.4 },
        { band: 3, gain: 0.25 },
        { band: 4, gain: 0.15 },
        { band: 5, gain: 0.0 },
        { band: 6, gain: -0.1 },
        { band: 7, gain: -0.1 },
        { band: 8, gain: -0.1 },
        { band: 9, gain: -0.1 },
        { band: 10, gain: -0.1 },
        { band: 11, gain: -0.1 },
        { band: 12, gain: -0.1 },
        { band: 13, gain: -0.1 },
        { band: 14, gain: -0.1 },
      ],
    },
  },
  treble: {
    name: "Treble Boost",
    description: "Enhanced high frequencies",
    filters: {
      equalizer: [
        { band: 0, gain: -0.1 },
        { band: 1, gain: -0.1 },
        { band: 2, gain: -0.1 },
        { band: 3, gain: -0.1 },
        { band: 4, gain: -0.1 },
        { band: 5, gain: 0.0 },
        { band: 6, gain: 0.1 },
        { band: 7, gain: 0.2 },
        { band: 8, gain: 0.3 },
        { band: 9, gain: 0.4 },
        { band: 10, gain: 0.45 },
        { band: 11, gain: 0.5 },
        { band: 12, gain: 0.55 },
        { band: 13, gain: 0.6 },
        { band: 14, gain: 0.6 },
      ],
    },
  },
  "8d": {
    name: "8D Audio",
    description: "Rotating audio effect",
    filters: {
      rotation: {
        rotationHz: 0.2,
      },
    },
  },
  karaoke: {
    name: "Karaoke",
    description: "Reduces vocals in the track",
    filters: {
      karaoke: {
        level: 1.0,
        monoLevel: 1.0,
        filterBand: 220.0,
        filterWidth: 100.0,
      },
    },
  },
  vibrato: {
    name: "Vibrato",
    description: "Adds vibrato effect",
    filters: {
      vibrato: {
        frequency: 4.0,
        depth: 0.75,
      },
    },
  },
  tremolo: {
    name: "Tremolo",
    description: "Adds tremolo effect",
    filters: {
      tremolo: {
        frequency: 4.0,
        depth: 0.75,
      },
    },
  },
  lowpass: {
    name: "Low Pass",
    description: "Muffled/underwater sound",
    filters: {
      lowPass: {
        smoothing: 20.0,
      },
    },
  },
  slowed: {
    name: "Slowed",
    description: "Slowed down playback",
    filters: {
      timescale: {
        speed: 0.8,
        pitch: 1.0,
        rate: 1.0,
      },
    },
  },
  speed: {
    name: "Speed Up",
    description: "Faster playback",
    filters: {
      timescale: {
        speed: 1.25,
        pitch: 1.0,
        rate: 1.0,
      },
    },
  },
  chipmunk: {
    name: "Chipmunk",
    description: "High pitched voice",
    filters: {
      timescale: {
        speed: 1.05,
        pitch: 1.35,
        rate: 1.25,
      },
    },
  },
  darth: {
    name: "Darth Vader",
    description: "Deep voice effect",
    filters: {
      timescale: {
        speed: 0.975,
        pitch: 0.5,
        rate: 0.8,
      },
    },
  },
  soft: {
    name: "Soft",
    description: "Softer, smoother sound",
    filters: {
      lowPass: {
        smoothing: 10.0,
      },
      equalizer: [
        { band: 0, gain: -0.2 },
        { band: 1, gain: -0.1 },
        { band: 2, gain: 0.0 },
        { band: 3, gain: 0.1 },
        { band: 4, gain: 0.15 },
        { band: 5, gain: 0.1 },
        { band: 6, gain: 0.05 },
        { band: 7, gain: 0.0 },
        { band: 8, gain: -0.05 },
        { band: 9, gain: -0.1 },
        { band: 10, gain: -0.15 },
        { band: 11, gain: -0.2 },
        { band: 12, gain: -0.25 },
        { band: 13, gain: -0.3 },
        { band: 14, gain: -0.35 },
      ],
    },
  },
};

const PRESET_CHOICES = Object.entries(FILTER_PRESETS).map(([key, preset]) => ({
  name: preset.name,
  value: key,
}));

@SlashCommand("filter", "Apply audio filters to the music")
@GuildOnly()
export class FilterCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addSubcommand((sub) =>
        sub
          .setName("preset")
          .setDescription("Apply a filter preset")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("The filter preset to apply")
              .setRequired(true)
              .addChoices(...PRESET_CHOICES)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("clear")
          .setDescription("Remove all filters")
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("List all available filter presets")
      )
      .addSubcommand((sub) =>
        sub
          .setName("speed")
          .setDescription("Adjust playback speed")
          .addNumberOption((option) =>
            option
              .setName("value")
              .setDescription("Speed multiplier (0.5 - 2.0)")
              .setRequired(true)
              .setMinValue(0.5)
              .setMaxValue(2.0)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("pitch")
          .setDescription("Adjust pitch")
          .addNumberOption((option) =>
            option
              .setName("value")
              .setDescription("Pitch multiplier (0.5 - 2.0)")
              .setRequired(true)
              .setMinValue(0.5)
              .setMaxValue(2.0)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("bassboost")
          .setDescription("Adjust bass boost level")
          .addIntegerOption((option) =>
            option
              .setName("level")
              .setDescription("Bass boost level (0-100)")
              .setRequired(true)
              .setMinValue(0)
              .setMaxValue(100)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("rotation")
          .setDescription("Apply 8D rotation effect")
          .addNumberOption((option) =>
            option
              .setName("speed")
              .setDescription("Rotation speed in Hz (0 to disable, 0.1-1.0 recommended)")
              .setRequired(true)
              .setMinValue(0)
              .setMaxValue(5)
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

    const subcommand = ctx.interaction.options.getSubcommand();

    switch (subcommand) {
      case "preset":
        await this.handlePreset(ctx, music);
        break;
      case "clear":
        await this.handleClear(ctx, music);
        break;
      case "list":
        await this.handleList(ctx);
        break;
      case "speed":
        await this.handleSpeed(ctx, music);
        break;
      case "pitch":
        await this.handlePitch(ctx, music);
        break;
      case "bassboost":
        await this.handleBassBoost(ctx, music);
        break;
      case "rotation":
        await this.handleRotation(ctx, music);
        break;
    }
  }

  private async handlePreset(ctx: CommandContext, music: NonNullable<BotClient["music"]>): Promise<void> {
    const presetName = ctx.interaction.options.getString("name", true);
    const preset = FILTER_PRESETS[presetName];

    if (!preset) {
      await ctx.reply({
        embeds: [ctx.error("Unknown filter preset!")],
        ephemeral: true,
      });
      return;
    }

    await ctx.defer();

    try {
      await music.setFilters(ctx.guild!.id, preset.filters);
      
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Filter Applied: ${preset.name}`)
        .setDescription(preset.description)
        .setFooter({ text: "Use /filter clear to remove filters" });

      await ctx.editReply({ embeds: [embed] });
    } catch (error) {
      await ctx.editReply({
        embeds: [ctx.error(`Failed to apply filter: ${(error as Error).message}`)],
      });
    }
  }

  private async handleClear(ctx: CommandContext, music: NonNullable<BotClient["music"]>): Promise<void> {
    await ctx.defer();

    try {
      await music.clearFilters(ctx.guild!.id);
      await ctx.editReply({
        embeds: [ctx.success("All filters have been cleared!")],
      });
    } catch (error) {
      await ctx.editReply({
        embeds: [ctx.error(`Failed to clear filters: ${(error as Error).message}`)],
      });
    }
  }

  private async handleList(ctx: CommandContext): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Available Filter Presets")
      .setDescription(
        Object.entries(FILTER_PRESETS)
          .map(([key, preset]) => `**${preset.name}** (\`${key}\`)\n${preset.description}`)
          .join("\n\n")
      )
      .addFields(
        {
          name: "Custom Adjustments",
          value: [
            "`/filter speed` - Adjust playback speed",
            "`/filter pitch` - Adjust pitch",
            "`/filter bassboost` - Adjust bass level",
            "`/filter rotation` - 8D audio effect",
          ].join("\n"),
        }
      )
      .setFooter({ text: "Use /filter preset <name> to apply a preset" });

    await ctx.reply({ embeds: [embed] });
  }

  private async handleSpeed(ctx: CommandContext, music: NonNullable<BotClient["music"]>): Promise<void> {
    const speed = ctx.interaction.options.getNumber("value", true);
    
    await ctx.defer();

    try {
      await music.setFilters(ctx.guild!.id, {
        timescale: {
          speed,
          pitch: 1.0,
          rate: 1.0,
        },
      });

      await ctx.editReply({
        embeds: [ctx.success(`Playback speed set to **${speed}x**`)],
      });
    } catch (error) {
      await ctx.editReply({
        embeds: [ctx.error(`Failed to set speed: ${(error as Error).message}`)],
      });
    }
  }

  private async handlePitch(ctx: CommandContext, music: NonNullable<BotClient["music"]>): Promise<void> {
    const pitch = ctx.interaction.options.getNumber("value", true);
    
    await ctx.defer();

    try {
      await music.setFilters(ctx.guild!.id, {
        timescale: {
          speed: 1.0,
          pitch,
          rate: 1.0,
        },
      });

      await ctx.editReply({
        embeds: [ctx.success(`Pitch set to **${pitch}x**`)],
      });
    } catch (error) {
      await ctx.editReply({
        embeds: [ctx.error(`Failed to set pitch: ${(error as Error).message}`)],
      });
    }
  }

  private async handleBassBoost(ctx: CommandContext, music: NonNullable<BotClient["music"]>): Promise<void> {
    const level = ctx.interaction.options.getInteger("level", true);
    
    await ctx.defer();

    // Convert 0-100 to gain values (0-0.75)
    const gain = (level / 100) * 0.75;
    
    const equalizer = [
      { band: 0, gain },
      { band: 1, gain: gain * 0.9 },
      { band: 2, gain: gain * 0.8 },
      { band: 3, gain: gain * 0.6 },
      { band: 4, gain: gain * 0.4 },
      { band: 5, gain: gain * 0.2 },
      { band: 6, gain: 0 },
      { band: 7, gain: 0 },
      { band: 8, gain: 0 },
      { band: 9, gain: 0 },
      { band: 10, gain: 0 },
      { band: 11, gain: 0 },
      { band: 12, gain: 0 },
      { band: 13, gain: 0 },
      { band: 14, gain: 0 },
    ];

    try {
      await music.setFilters(ctx.guild!.id, { equalizer });

      const emoji = level === 0 ? "🔇" : level < 33 ? "🔈" : level < 66 ? "🔉" : "🔊";
      await ctx.editReply({
        embeds: [ctx.success(`${emoji} Bass boost set to **${level}%**`)],
      });
    } catch (error) {
      await ctx.editReply({
        embeds: [ctx.error(`Failed to set bass boost: ${(error as Error).message}`)],
      });
    }
  }

  private async handleRotation(ctx: CommandContext, music: NonNullable<BotClient["music"]>): Promise<void> {
    const rotationHz = ctx.interaction.options.getNumber("speed", true);
    
    await ctx.defer();

    try {
      if (rotationHz === 0) {
        await music.setFilters(ctx.guild!.id, { rotation: undefined });
        await ctx.editReply({
          embeds: [ctx.success("8D rotation effect disabled")],
        });
      } else {
        await music.setFilters(ctx.guild!.id, { rotation: { rotationHz } });
        await ctx.editReply({
          embeds: [ctx.success(`8D rotation effect enabled at **${rotationHz} Hz**`)],
        });
      }
    } catch (error) {
      await ctx.editReply({
        embeds: [ctx.error(`Failed to set rotation: ${(error as Error).message}`)],
      });
    }
  }
}
