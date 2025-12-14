import { SlashCommandBuilder, ChannelType, type AutocompleteInteraction  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";
import { formatDuration } from "@/utils/format";
import type { Track } from "@discordbot/lavalink";
import type { SearchPlatform } from "@/types/music";

const PLATFORM_CHOICES = [
  { name: "YouTube", value: "youtube" },
  { name: "YouTube Music", value: "youtubemusic" },
  { name: "SoundCloud", value: "soundcloud" },
  { name: "Spotify", value: "spotify" },
  { name: "Deezer", value: "deezer" },
  { name: "Apple Music", value: "applemusic" },
] as const;

/**
 * Format track name for autocomplete display
 * Truncates to fit Discord's 100 character limit
 */
function formatTrackName(track: Track): string {
  const author = track.info.author;
  const title = track.info.title;
  const duration = formatDuration(track.info.length);
  
  // Format: "Author - Title [Duration]"
  const full = `${author} - ${title} [${duration}]`;
  
  if (full.length <= 100) {
    return full;
  }
  
  // Truncate title if too long
  const maxTitleLength = 100 - author.length - duration.length - 8; // " - " + " [" + "]"
  if (maxTitleLength > 10) {
    return `${author} - ${title.slice(0, maxTitleLength - 3)}... [${duration}]`;
  }
  
  // If author is too long, just use title
  return `${title.slice(0, 93)}... [${duration}]`;
}

@SlashCommand("play", "Play a song or add it to the queue")
@GuildOnly()
export class PlayCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addStringOption((option) =>
        option
          .setName("query")
          .setDescription("Song name or URL")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((option) =>
        option
          .setName("source")
          .setDescription("Music source to search from")
          .setRequired(false)
          .addChoices(...PLATFORM_CHOICES)
      );
  }

  override async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const query = interaction.options.getFocused();
    const source = interaction.options.getString("source") as SearchPlatform | null;
    
    // Don't search for very short queries or URLs
    if (query.length < 2 || query.startsWith("http://") || query.startsWith("https://")) {
      await interaction.respond([]);
      return;
    }

    const music = this.client.music;
    if (!music) {
      await interaction.respond([]);
      return;
    }

    try {
      const result = await music.search(query, source ?? undefined);
      
      let tracks: Track[] = [];
      
      if (result.loadType === "search" && result.data.length > 0) {
        tracks = result.data.slice(0, 10);
      } else if (result.loadType === "track") {
        tracks = [result.data];
      } else if (result.loadType === "playlist" && result.data.tracks.length > 0) {
        // For playlists, show the playlist name as first option
        await interaction.respond([
          {
            name: `📑 Playlist: ${result.data.info.name} (${result.data.tracks.length} tracks)`.slice(0, 100),
            value: query,
          },
          ...result.data.tracks.slice(0, 9).map((track) => ({
            name: formatTrackName(track),
            value: track.info.uri ?? track.encoded,
          })),
        ]);
        return;
      }

      const choices = tracks.map((track) => ({
        name: formatTrackName(track),
        value: track.info.uri ?? track.encoded,
      }));

      await interaction.respond(choices);
    } catch {
      await interaction.respond([]);
    }
  }

  async execute(ctx: CommandContext): Promise<void> {
    const query = ctx.interaction.options.getString("query", true);
    const source = ctx.interaction.options.getString("source") as SearchPlatform | null;
    const member = ctx.member;

    if (!member?.voice.channel) {
      await ctx.reply({
        embeds: [ctx.error("You need to be in a voice channel to play music!")],
        ephemeral: true,
      });
      return;
    }

    const voiceChannel = member.voice.channel;

    // Check if bot can join the voice channel
    if (voiceChannel.type !== ChannelType.GuildVoice && voiceChannel.type !== ChannelType.GuildStageVoice) {
      await ctx.reply({
        embeds: [ctx.error("Invalid voice channel type!")],
        ephemeral: true,
      });
      return;
    }

    await ctx.defer();

    const music = this.client.music;
    if (!music) {
      await ctx.editReply({
        embeds: [ctx.error("Music system is not available!")],
      });
      return;
    }

    try {
      // Connect to voice channel if not already connected
      const queue = music.getQueue(ctx.guild!.id);
      if (!queue.voiceChannelId) {
        await music.connect(ctx.guild!.id, voiceChannel.id);
      }

      // Set text channel for now playing messages
      queue.textChannelId = ctx.channel?.id ?? null;

      // Search for the track
      const result = await music.search(query, source ?? undefined);

      if (result.loadType === "empty" || result.loadType === "error") {
        await ctx.editReply({
          embeds: [ctx.error("No results found for your query!")],
        });
        return;
      }

      let tracks;
      let message: string;

      if (result.loadType === "playlist" && result.data.tracks) {
        tracks = result.data.tracks;
        message = `Added **${tracks.length}** tracks from playlist **${result.data.info.name}** to the queue`;
      } else if (result.loadType === "track") {
        tracks = [result.data];
        message = `Added **${result.data.info.title}** to the queue`;
      } else if (result.loadType === "search" && result.data.length > 0) {
        tracks = [result.data[0]!];
        message = `Added **${result.data[0]!.info.title}** to the queue`;
      } else {
        await ctx.editReply({
          embeds: [ctx.error("No results found for your query!")],
        });
        return;
      }

      const { position } = await music.play(
        ctx.guild!.id,
        tracks,
        ctx.user.tag,
        ctx.user.id
      );

      const embed = ctx
        .success(message)
        .setFooter({ text: position > 0 ? `Position in queue: ${position}` : "Now playing" });

      if (tracks.length === 1 && tracks[0]?.info.artworkUrl) {
        embed.setThumbnail(tracks[0].info.artworkUrl);
      }

      await ctx.editReply({ embeds: [embed] });
    } catch (error) {
      this.client.logger.error("Play command error:", error);
      await ctx.editReply({
        embeds: [ctx.error(`Failed to play: ${(error as Error).message}`)],
      });
    }
  }
}
