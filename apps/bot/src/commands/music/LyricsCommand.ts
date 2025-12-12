import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";

interface LRCLibResponse {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

/**
 * Strip common YouTube title suffixes and clean up the title for lyrics search
 */
function stripYouTubeTitle(title: string): { cleanTitle: string; artist?: string } {
  let cleanTitle = title;

  // Common patterns to remove
  const patternsToRemove = [
    // Official video markers
    /\s*\(?\s*official\s*(music\s*)?(video|audio|lyric(s)?|mv|visualizer)\s*\)?/gi,
    /\s*\[?\s*official\s*(music\s*)?(video|audio|lyric(s)?|mv|visualizer)\s*\]?/gi,
    // Quality markers
    /\s*\(?\s*(4k|hd|hq|high\s*quality)\s*\)?/gi,
    /\s*\[?\s*(4k|hd|hq|high\s*quality)\s*\]?/gi,
    // Year markers
    /\s*\(?\s*\d{4}\s*\)?$/gi,
    /\s*\[?\s*\d{4}\s*\]?$/gi,
    // Remaster/version markers
    /\s*\(?\s*(remaster(ed)?|remix|version|ver\.?|edit|extended|radio\s*edit)\s*\d*\s*\)?/gi,
    /\s*\[?\s*(remaster(ed)?|remix|version|ver\.?|edit|extended|radio\s*edit)\s*\d*\s*\]?/gi,
    // Lyric markers
    /\s*\(?\s*with\s*lyrics?\s*\)?/gi,
    /\s*\[?\s*with\s*lyrics?\s*\]?/gi,
    /\s*\(?\s*lyrics?\s*(video)?\s*\)?/gi,
    /\s*\[?\s*lyrics?\s*(video)?\s*\]?/gi,
    // Audio markers
    /\s*\(?\s*(audio|audio\s*only)\s*\)?/gi,
    /\s*\[?\s*(audio|audio\s*only)\s*\]?/gi,
    // Live markers (optional - might want to keep for some searches)
    /\s*\(?\s*live(\s*(at|@|from)\s*.+?)?\s*\)?$/gi,
    /\s*\[?\s*live(\s*(at|@|from)\s*.+?)?\s*\]?$/gi,
    // Feat markers cleanup (normalize)
    /\s*\(?\s*ft\.?\s*/gi,
    /\s*\(?\s*feat\.?\s*/gi,
    // Topic channel suffix
    /\s*-\s*topic$/gi,
    // Trailing special characters
    /[\|\-\~]\s*$/g,
    // Multiple spaces
    /\s+/g,
  ];

  for (const pattern of patternsToRemove) {
    cleanTitle = cleanTitle.replace(pattern, " ");
  }

  cleanTitle = cleanTitle.trim();

  // Try to extract artist from "Artist - Title" format
  let artist: string | undefined;
  const dashMatch = cleanTitle.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    artist = dashMatch[1]?.trim();
    cleanTitle = dashMatch[2]?.trim() ?? cleanTitle;
  }

  return { cleanTitle, artist };
}

/**
 * Search for lyrics using LRCLIB API
 */
async function searchLyrics(
  trackName: string,
  artistName?: string,
  albumName?: string,
  duration?: number
): Promise<LRCLibResponse | null> {
  try {
    // First try the get endpoint if we have both artist and track
    if (artistName && trackName) {
      const params = new URLSearchParams({
        artist_name: artistName,
        track_name: trackName,
      });

      if (albumName) {
        params.set("album_name", albumName);
      }

      if (duration) {
        params.set("duration", Math.floor(duration).toString());
      }

      const response = await fetch(`https://lrclib.net/api/get?${params}`);
      if (response.ok) {
        return await response.json() as LRCLibResponse;
      }
    }

    // Fall back to search endpoint
    const searchQuery = artistName ? `${artistName} ${trackName}` : trackName;
    const searchResponse = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`
    );

    if (!searchResponse.ok) {
      return null;
    }

    const results = await searchResponse.json() as LRCLibResponse[];
    return results.length > 0 ? results[0]! : null;
  } catch {
    return null;
  }
}

/**
 * Split lyrics into chunks that fit Discord's embed description limit
 */
function splitLyrics(lyrics: string, maxLength: number = 4000): string[] {
  if (lyrics.length <= maxLength) {
    return [lyrics];
  }

  const chunks: string[] = [];
  const lines = lyrics.split("\n");
  let currentChunk = "";

  for (const line of lines) {
    if ((currentChunk + "\n" + line).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? "\n" : "") + line;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

@SlashCommand("lyrics", "Get lyrics for the current song or search for lyrics")
@GuildOnly()
export class LyricsCommand extends Command {
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
          .setDescription("Search for lyrics (leave empty for current song)")
          .setRequired(false)
      );
  }

  async execute(ctx: CommandContext): Promise<void> {
    const query = ctx.interaction.options.getString("query");

    await ctx.defer();

    let trackName: string;
    let artistName: string | undefined;
    let albumName: string | undefined;
    let duration: number | undefined;
    let artworkUrl: string | null = null;

    if (query) {
      // User provided a search query
      const { cleanTitle, artist } = stripYouTubeTitle(query);
      trackName = cleanTitle;
      artistName = artist;
    } else {
      // Get from currently playing track
      const music = this.client.music;
      if (!music) {
        await ctx.editReply({
          embeds: [ctx.error("Music system is not available!")],
        });
        return;
      }

      const queue = music.queues.get(ctx.guild!.id);
      if (!queue?.current) {
        await ctx.editReply({
          embeds: [ctx.error("Nothing is playing! Provide a search query or play a song first.")],
        });
        return;
      }

      const track = queue.current.track;
      const { cleanTitle, artist } = stripYouTubeTitle(track.info.title);

      trackName = cleanTitle;
      artistName = artist ?? (track.info.author !== "Unknown" ? track.info.author : undefined);
      duration = track.info.length / 1000; // Convert to seconds
      artworkUrl = track.info.artworkUrl;
    }

    // Search for lyrics
    const lyricsResult = await searchLyrics(trackName, artistName, albumName, duration);

    if (!lyricsResult || (!lyricsResult.plainLyrics && lyricsResult.instrumental)) {
      const searchedFor = artistName ? `${artistName} - ${trackName}` : trackName;
      
      if (lyricsResult?.instrumental) {
        await ctx.editReply({
          embeds: [ctx.info(`**${searchedFor}** is an instrumental track.`)],
        });
      } else {
        await ctx.editReply({
          embeds: [ctx.error(`No lyrics found for **${searchedFor}**`)],
        });
      }
      return;
    }

    const lyrics = lyricsResult.plainLyrics ?? "";
    const chunks = splitLyrics(lyrics);

    // Build the first embed with full info
    const firstEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: "Lyrics" })
      .setTitle(`${lyricsResult.artistName} - ${lyricsResult.trackName}`)
      .setDescription(chunks[0] ?? "")
      .setFooter({ text: `Album: ${lyricsResult.albumName ?? "Unknown"} • Powered by LRCLIB` });

    if (artworkUrl) {
      firstEmbed.setThumbnail(artworkUrl);
    }

    const embeds = [firstEmbed];

    // Add additional chunks as separate embeds
    for (let i = 1; i < chunks.length; i++) {
      embeds.push(
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setDescription(chunks[i] ?? "")
      );
    }

    // Discord allows max 10 embeds per message
    if (embeds.length > 10) {
      embeds.length = 10;
      embeds[9]!.setFooter({ 
        text: "Lyrics truncated due to length • Powered by LRCLIB" 
      });
    }

    await ctx.editReply({ embeds });
  }
}
