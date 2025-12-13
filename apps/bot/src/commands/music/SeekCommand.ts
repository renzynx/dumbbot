import { SlashCommandBuilder  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";
import { formatDuration } from "@/utils/format";

/**
 * Parse a time string into milliseconds
 * Supports formats: "1:30", "1:30:00", "90", "90s", "1m30s", "1h30m"
 */
function parseTimeString(input: string): number | null {
  const trimmed = input.trim().toLowerCase();

  // Format: 1:30 or 1:30:00 (mm:ss or hh:mm:ss)
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map((p) => parseInt(p, 10));
    
    if (parts.some((p) => isNaN(p) || p < 0)) {
      return null;
    }

    if (parts.length === 2) {
      // mm:ss
      const [minutes, seconds] = parts as [number, number];
      return (minutes * 60 + seconds) * 1000;
    } else if (parts.length === 3) {
      // hh:mm:ss
      const [hours, minutes, seconds] = parts as [number, number, number];
      return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }
    return null;
  }

  // Format: 1h30m45s, 1h30m, 30m, 90s, etc.
  const timeRegex = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
  const match = trimmed.match(timeRegex);
  
  if (match && (match[1] || match[2] || match[3])) {
    const hours = parseInt(match[1] ?? "0", 10);
    const minutes = parseInt(match[2] ?? "0", 10);
    const seconds = parseInt(match[3] ?? "0", 10);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  // Format: plain number (seconds)
  const plainSeconds = parseInt(trimmed, 10);
  if (!isNaN(plainSeconds) && plainSeconds >= 0) {
    return plainSeconds * 1000;
  }

  return null;
}

@SlashCommand("seek", "Seek to a specific position in the current track")
@GuildOnly()
export class SeekCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addStringOption((option) =>
        option
          .setName("position")
          .setDescription("Time to seek to (e.g., 1:30, 90, 1m30s, 1h30m)")
          .setRequired(true)
      )
      .addBooleanOption((option) =>
        option
          .setName("relative")
          .setDescription("Seek relative to current position (+ forward, - backward)")
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
    if (!queue?.current) {
      await ctx.reply({
        embeds: [ctx.error("Nothing is playing!")],
        ephemeral: true,
      });
      return;
    }

    const member = ctx.member;
    if (!member?.voice.channel) {
      await ctx.reply({
        embeds: [ctx.error("You need to be in a voice channel!")],
        ephemeral: true,
      });
      return;
    }

    const positionInput = ctx.interaction.options.getString("position", true);
    const isRelative = ctx.interaction.options.getBoolean("relative") ?? false;

    // Check for relative seek with +/- prefix
    let relativeMode = isRelative;
    let direction = 1;
    let cleanInput = positionInput;

    if (positionInput.startsWith("+")) {
      relativeMode = true;
      direction = 1;
      cleanInput = positionInput.slice(1);
    } else if (positionInput.startsWith("-")) {
      relativeMode = true;
      direction = -1;
      cleanInput = positionInput.slice(1);
    }

    const parsedTime = parseTimeString(cleanInput);
    if (parsedTime === null) {
      await ctx.reply({
        embeds: [ctx.error("Invalid time format! Use formats like: `1:30`, `90`, `1m30s`, `1h30m`")],
        ephemeral: true,
      });
      return;
    }

    const track = queue.current.track;
    const duration = track.info.length;

    // Get current position
    const node = music.getIdealNode();
    const player = node?.getPlayer(ctx.guild!.id);
    const currentPosition = player?.state?.position ?? 0;

    // Calculate target position
    let targetPosition: number;
    if (relativeMode) {
      targetPosition = currentPosition + parsedTime * direction;
    } else {
      targetPosition = parsedTime;
    }

    // Clamp to valid range
    targetPosition = Math.max(0, Math.min(targetPosition, duration));

    // Check if track is seekable
    if (!track.info.isSeekable) {
      await ctx.reply({
        embeds: [ctx.error("This track is not seekable!")],
        ephemeral: true,
      });
      return;
    }

    await ctx.defer();

    try {
      await music.seek(ctx.guild!.id, targetPosition);

      const embed = ctx
        .success(`Seeked to **${formatDuration(targetPosition)}** / ${formatDuration(duration)}`)
        .setFooter({ text: track.info.title });

      await ctx.editReply({ embeds: [embed] });
    } catch (error) {
      await ctx.editReply({
        embeds: [ctx.error(`Failed to seek: ${(error as Error).message}`)],
      });
    }
  }
}
