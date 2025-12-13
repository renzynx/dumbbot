import type { APIServer } from "@/api/server";
import type { QueueTrack, HistoryTrack } from "@/music/Queue";
import type { MusicManager } from "@/music/MusicManager";
import type { Client, VoiceBasedChannel } from "discord.js";
import { ChannelType } from "discord.js";
import { Logger } from "@/utils/Logger";

const logger = new Logger("Helpers");

/**
 * Format a queue track for API response
 */
export function formatTrack(track: QueueTrack) {
  return {
    encoded: track.track.encoded,
    identifier: track.track.info.identifier,
    title: track.track.info.title,
    author: track.track.info.author,
    uri: track.track.info.uri,
    duration: track.track.info.length,
    artworkUrl: track.track.info.artworkUrl,
    sourceName: track.track.info.sourceName,
    isStream: track.track.info.isStream,
    requester: track.requester,
    requesterId: track.requesterId,
  };
}

/**
 * Format a history track for API response
 */
export function formatHistoryTrack(track: HistoryTrack) {
  return {
    ...formatTrack(track),
    playedAt: track.playedAt,
  };
}

/**
 * Broadcast player update to all subscribed WebSocket clients
 * Uses cached player state from MusicManager for better performance
 */
export function broadcastPlayerUpdate(server: APIServer, music: MusicManager, guildId: string) {
  // Delegate to MusicManager's broadcastPlayerUpdate which uses cached state
  music.broadcastPlayerUpdate(guildId);
}

/**
 * Find the voice channel a user is currently in within a guild
 */
export async function getUserVoiceChannel(
  client: Client,
  guildId: string,
  userId: string
): Promise<VoiceBasedChannel | null> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;

  // Try to get from cache first, then fetch if not found
  let member = guild.members.cache.get(userId);
  if (!member) {
    try {
      member = await guild.members.fetch(userId);
    } catch {
      return null;
    }
  }

  if (!member?.voice.channel) return null;

  const channel = member.voice.channel;

  // Ensure it's a valid voice channel type
  if (
    channel.type !== ChannelType.GuildVoice &&
    channel.type !== ChannelType.GuildStageVoice
  ) {
    return null;
  }

  return channel;
}

/**
 * Ensure the bot is connected to the user's voice channel
 * Returns an error message if unable to connect, or null if successful
 */
export async function ensureVoiceConnection(
  music: MusicManager,
  client: Client,
  guildId: string,
  userId: string
): Promise<string | null> {
  const queue = music.getQueue(guildId);

  // Already connected to a voice channel
  if (queue.voiceChannelId) {
    const botChannel = music.voiceConnections.get(guildId);
    if (botChannel) {
      // Check if user is in the same channel as the bot
      const userChannel = await getUserVoiceChannel(client, guildId, userId);
      if (userChannel && userChannel.id !== botChannel.channelId) {
        return "You need to be in the same voice channel as the bot";
      }
      return null; // Already connected, all good
    }
  }

  // Find user's voice channel
  const userChannel = await getUserVoiceChannel(client, guildId, userId);
  if (!userChannel) {
    return "You need to be in a voice channel to play music";
  }

  // Connect to the user's voice channel
  try {
    await music.connect(guildId, userChannel.id);
    return null;
  } catch (error) {
    logger.error("Failed to connect to voice channel:", error);
    return "Failed to connect to your voice channel";
  }
}
