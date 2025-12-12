import { SlashCommandBuilder, EmbedBuilder  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";

@SlashCommand("nowplaying", "Show the currently playing song")
@GuildOnly()
export class NowPlayingCommand extends Command {
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
    if (!queue?.current) {
      await ctx.reply({
        embeds: [ctx.error("Nothing is playing!")],
        ephemeral: true,
      });
      return;
    }

    const track = queue.current.track;
    const node = music.getIdealNode();
    const player = node?.getPlayer(ctx.guild!.id);
    const position = player?.state?.position ?? 0;

    // Create progress bar
    const duration = track.info.length;
    const progress = Math.min(position / duration, 1);
    const barLength = 15;
    const filledLength = Math.round(barLength * progress);
    const emptyLength = barLength - filledLength;
    const progressBar = "▬".repeat(filledLength) + "🔘" + "▬".repeat(emptyLength);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: "Now Playing" })
      .setTitle(track.info.title)
      .setURL(track.info.uri ?? null)
      .setThumbnail(track.info.artworkUrl ?? null)
      .addFields(
        { name: "Artist", value: track.info.author || "Unknown", inline: true },
        { name: "Requested by", value: queue.current.requester, inline: true },
        { name: "Volume", value: `${queue.volume}%`, inline: true },
        {
          name: "Progress",
          value: `${progressBar}\n${music.formatDuration(position)} / ${music.formatDuration(duration)}`,
          inline: false,
        }
      );

    if (queue.loopMode !== "none") {
      embed.addFields({
        name: "Loop",
        value: queue.loopMode === "track" ? "🔂 Track" : "🔁 Queue",
        inline: true,
      });
    }

    await ctx.reply({ embeds: [embed] });
  }
}
