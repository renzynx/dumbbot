import { SlashCommandBuilder, EmbedBuilder, type AutocompleteInteraction  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";
import type { SavedTrack, SavedPlaylist } from "@/music/GuildSettings";

@SlashCommand("playlist", "Manage your playlists")
@GuildOnly()
export class PlaylistCommand extends Command {
  constructor(client: BotClient) {
    super(client);
  }

  override build() {
    return new SlashCommandBuilder()
      .setName(this.name)
      .setDescription(this.description)
      .addSubcommand((sub) =>
        sub
          .setName("create")
          .setDescription("Create a new playlist")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Name of the playlist")
              .setRequired(true)
              .setMaxLength(50)
          )
          .addBooleanOption((option) =>
            option
              .setName("public")
              .setDescription("Make this playlist public (default: false)")
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("delete")
          .setDescription("Delete a playlist")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Name of the playlist to delete")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("List all your playlists")
      )
      .addSubcommand((sub) =>
        sub
          .setName("view")
          .setDescription("View tracks in a playlist")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Name of the playlist")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("load")
          .setDescription("Load a playlist into the queue")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Name of the playlist")
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addBooleanOption((option) =>
            option
              .setName("shuffle")
              .setDescription("Shuffle the playlist before adding (default: false)")
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("save")
          .setDescription("Save the current queue as a playlist")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Name for the new playlist")
              .setRequired(true)
              .setMaxLength(50)
          )
          .addBooleanOption((option) =>
            option
              .setName("public")
              .setDescription("Make this playlist public (default: false)")
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("addcurrent")
          .setDescription("Add the currently playing track to a playlist")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Name of the playlist")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a track from a playlist")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Name of the playlist")
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("position")
              .setDescription("Position of the track to remove (1-based)")
              .setMinValue(1)
              .setRequired(true)
          )
      );
  }

  override async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const music = this.client.music;
    if (!music || !interaction.guildId) {
      await interaction.respond([]);
      return;
    }

    const focused = interaction.options.getFocused().toLowerCase();
    const subcommand = interaction.options.getSubcommand();
    
    // For delete, addcurrent, remove - show only user's playlists
    // For view, load - show accessible playlists (own + public)
    let playlists;
    if (subcommand === "delete" || subcommand === "remove") {
      playlists = music.settings.getUserPlaylists(interaction.guildId, interaction.user.id);
    } else {
      playlists = music.settings.getAccessiblePlaylists(interaction.guildId, interaction.user.id);
    }

    const filtered = playlists
      .filter((p) => p.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((p) => ({
        name: `${p.name} (${p.tracks.length} tracks)${p.ownerId !== interaction.user.id ? " [Public]" : ""}`,
        value: p.name,
      }));

    await interaction.respond(filtered);
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
      case "create": {
        const name = ctx.interaction.options.getString("name", true);
        const isPublic = ctx.interaction.options.getBoolean("public") ?? false;

        // Check if playlist with same name exists
        const existing = music.settings.getPlaylistByName(guildId, name);
        if (existing) {
          await ctx.reply({
            embeds: [ctx.error("A playlist with that name already exists!")],
            ephemeral: true,
          });
          return;
        }

        music.settings.createPlaylist(guildId, ctx.user.id, ctx.user.username, name, isPublic);
        await ctx.reply({
          embeds: [ctx.success(`Created ${isPublic ? "public" : "private"} playlist **${name}**`)],
        });
        break;
      }

      case "delete": {
        const name = ctx.interaction.options.getString("name", true);
        const playlist = music.settings.getPlaylistByName(guildId, name);

        if (!playlist) {
          await ctx.reply({
            embeds: [ctx.error("Playlist not found!")],
            ephemeral: true,
          });
          return;
        }

        if (playlist.ownerId !== ctx.user.id) {
          await ctx.reply({
            embeds: [ctx.error("You can only delete your own playlists!")],
            ephemeral: true,
          });
          return;
        }

        music.settings.deletePlaylist(playlist.id);
        await ctx.reply({
          embeds: [ctx.success(`Deleted playlist **${name}**`)],
        });
        break;
      }

      case "list": {
        const playlists = music.settings.getUserPlaylists(guildId, ctx.user.id);

        if (playlists.length === 0) {
          await ctx.reply({
            embeds: [ctx.info("You don't have any playlists. Create one with `/playlist create`!")],
            ephemeral: true,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("Your Playlists")
          .setDescription(
            playlists
              .map((p, i) => `**${i + 1}.** ${p.name} (${p.tracks.length} tracks)${p.isPublic ? " [Public]" : ""}`)
              .join("\n")
          )
          .setFooter({ text: `${playlists.length} playlist${playlists.length !== 1 ? "s" : ""}` });

        await ctx.reply({ embeds: [embed] });
        break;
      }

      case "view": {
        const name = ctx.interaction.options.getString("name", true);
        const playlist = music.settings.getPlaylistByName(guildId, name);

        if (!playlist) {
          await ctx.reply({
            embeds: [ctx.error("Playlist not found!")],
            ephemeral: true,
          });
          return;
        }

        if (playlist.ownerId !== ctx.user.id && !playlist.isPublic) {
          await ctx.reply({
            embeds: [ctx.error("This playlist is private!")],
            ephemeral: true,
          });
          return;
        }

        if (playlist.tracks.length === 0) {
          await ctx.reply({
            embeds: [ctx.info(`Playlist **${playlist.name}** is empty.`)],
            ephemeral: true,
          });
          return;
        }

        const totalDuration = playlist.tracks.reduce((acc, t) => acc + t.duration, 0);
        
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(playlist.name)
          .setDescription(
            playlist.tracks
              .slice(0, 20)
              .map((t, i) => `**${i + 1}.** ${t.title} - ${t.author}`)
              .join("\n") +
              (playlist.tracks.length > 20 ? `\n... and ${playlist.tracks.length - 20} more` : "")
          )
          .setFooter({ 
            text: `${playlist.tracks.length} tracks • ${music.formatDuration(totalDuration)} • By ${playlist.ownerName}` 
          });

        await ctx.reply({ embeds: [embed] });
        break;
      }

      case "load": {
        const name = ctx.interaction.options.getString("name", true);
        const shuffle = ctx.interaction.options.getBoolean("shuffle") ?? false;
        const playlist = music.settings.getPlaylistByName(guildId, name);

        if (!playlist) {
          await ctx.reply({
            embeds: [ctx.error("Playlist not found!")],
            ephemeral: true,
          });
          return;
        }

        if (playlist.ownerId !== ctx.user.id && !playlist.isPublic) {
          await ctx.reply({
            embeds: [ctx.error("This playlist is private!")],
            ephemeral: true,
          });
          return;
        }

        if (playlist.tracks.length === 0) {
          await ctx.reply({
            embeds: [ctx.error("This playlist is empty!")],
            ephemeral: true,
          });
          return;
        }

        // Check if user is in voice channel
        const member = ctx.member;
        if (!member?.voice.channel) {
          await ctx.reply({
            embeds: [ctx.error("You need to be in a voice channel!")],
            ephemeral: true,
          });
          return;
        }

        // Connect if not connected
        const connection = music.voiceConnections.get(guildId);
        if (!connection) {
          await music.connect(guildId, member.voice.channel.id);
        }

        // Get queue and set text channel
        const queue = music.getQueue(guildId);
        queue.textChannelId = ctx.channel?.id ?? null;

        // Load tracks
        const node = music.getIdealNode();
        if (!node) {
          await ctx.reply({
            embeds: [ctx.error("No available music nodes!")],
            ephemeral: true,
          });
          return;
        }

        let tracks = [...playlist.tracks];
        if (shuffle) {
          for (let i = tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j]!, tracks[i]!];
          }
        }

        // Decode and add tracks
        let addedCount = 0;
        for (const savedTrack of tracks) {
          try {
            const result = await node.decodeTracks([savedTrack.encoded]);
            if (result.length > 0) {
              queue.add(result[0]!, ctx.user.username, ctx.user.id);
              addedCount++;
            }
          } catch {
            // Skip failed tracks
          }
        }

        // Start playing if nothing is playing
        if (!queue.current) {
          const next = queue.next();
          if (next) {
            await music.playTrack(guildId, next);
          }
        }

        await ctx.reply({
          embeds: [ctx.success(`Loaded **${addedCount}** tracks from **${playlist.name}**${shuffle ? " (shuffled)" : ""}`)],
        });
        break;
      }

      case "save": {
        const name = ctx.interaction.options.getString("name", true);
        const isPublic = ctx.interaction.options.getBoolean("public") ?? false;

        const queue = music.queues.get(guildId);
        if (!queue || (queue.size === 0 && !queue.current)) {
          await ctx.reply({
            embeds: [ctx.error("The queue is empty! Nothing to save.")],
            ephemeral: true,
          });
          return;
        }

        // Check if playlist with same name exists
        const existing = music.settings.getPlaylistByName(guildId, name);
        if (existing) {
          await ctx.reply({
            embeds: [ctx.error("A playlist with that name already exists!")],
            ephemeral: true,
          });
          return;
        }

        const playlist = music.settings.createPlaylist(guildId, ctx.user.id, ctx.user.username, name, isPublic);

        // Add current track if playing
        const tracks: SavedTrack[] = [];
        if (queue.current) {
          tracks.push({
            encoded: queue.current.track.encoded,
            title: queue.current.track.info.title,
            author: queue.current.track.info.author,
            uri: queue.current.track.info.uri ?? "",
            duration: queue.current.track.info.length,
            artworkUrl: queue.current.track.info.artworkUrl ?? undefined,
          });
        }

        // Add queued tracks
        for (const queueTrack of queue.tracks) {
          tracks.push({
            encoded: queueTrack.track.encoded,
            title: queueTrack.track.info.title,
            author: queueTrack.track.info.author,
            uri: queueTrack.track.info.uri ?? "",
            duration: queueTrack.track.info.length,
            artworkUrl: queueTrack.track.info.artworkUrl ?? undefined,
          });
        }

        music.settings.addTracksToPlaylist(playlist.id, tracks);

        await ctx.reply({
          embeds: [ctx.success(`Saved **${tracks.length}** tracks to ${isPublic ? "public" : "private"} playlist **${name}**`)],
        });
        break;
      }

      case "addcurrent": {
        const name = ctx.interaction.options.getString("name", true);
        const playlist = music.settings.getPlaylistByName(guildId, name);

        if (!playlist) {
          await ctx.reply({
            embeds: [ctx.error("Playlist not found!")],
            ephemeral: true,
          });
          return;
        }

        if (playlist.ownerId !== ctx.user.id) {
          await ctx.reply({
            embeds: [ctx.error("You can only add tracks to your own playlists!")],
            ephemeral: true,
          });
          return;
        }

        const queue = music.queues.get(guildId);
        if (!queue?.current) {
          await ctx.reply({
            embeds: [ctx.error("Nothing is currently playing!")],
            ephemeral: true,
          });
          return;
        }

        const track = queue.current.track;
        music.settings.addTracksToPlaylist(playlist.id, [{
          encoded: track.encoded,
          title: track.info.title,
          author: track.info.author,
          uri: track.info.uri ?? "",
          duration: track.info.length,
          artworkUrl: track.info.artworkUrl ?? undefined,
        }]);

        await ctx.reply({
          embeds: [ctx.success(`Added **${track.info.title}** to **${playlist.name}**`)],
        });
        break;
      }

      case "remove": {
        const name = ctx.interaction.options.getString("name", true);
        const position = ctx.interaction.options.getInteger("position", true);
        const playlist = music.settings.getPlaylistByName(guildId, name);

        if (!playlist) {
          await ctx.reply({
            embeds: [ctx.error("Playlist not found!")],
            ephemeral: true,
          });
          return;
        }

        if (playlist.ownerId !== ctx.user.id) {
          await ctx.reply({
            embeds: [ctx.error("You can only modify your own playlists!")],
            ephemeral: true,
          });
          return;
        }

        const index = position - 1;
        if (index < 0 || index >= playlist.tracks.length) {
          await ctx.reply({
            embeds: [ctx.error(`Invalid position! Please enter a number between 1 and ${playlist.tracks.length}.`)],
            ephemeral: true,
          });
          return;
        }

        const removed = music.settings.removeTrackFromPlaylist(playlist.id, index);
        if (!removed) {
          await ctx.reply({
            embeds: [ctx.error("Failed to remove track.")],
            ephemeral: true,
          });
          return;
        }

        await ctx.reply({
          embeds: [ctx.success(`Removed **${removed.title}** from **${playlist.name}**`)],
        });
        break;
      }
    }
  }
}
