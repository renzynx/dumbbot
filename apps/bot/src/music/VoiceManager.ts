import {
  Collection,
  GatewayDispatchEvents,
  type GatewayVoiceServerUpdateDispatchData,
  type GatewayVoiceStateUpdateDispatchData,
} from "discord.js";
import type { LavalinkNode } from "@discordbot/lavalink";
import type { BotClient } from "@/core/Client";
import { Logger } from "@/utils/Logger";
import type { VoiceConnection } from "@/types/music";

interface PendingConnection {
  resolve: (value: void) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Manages voice connections to Discord voice channels
 */
export class VoiceManager {
  private readonly client: BotClient;
  private readonly logger = new Logger("Voice");
  private readonly connections = new Collection<string, VoiceConnection>();
  private readonly pendingConnections = new Collection<string, PendingConnection>();
  private getNode: () => LavalinkNode | null;

  constructor(client: BotClient, getNode: () => LavalinkNode | null) {
    this.client = client;
    this.getNode = getNode;
    this.setupVoiceHandlers();
  }

  /**
   * Get a voice connection for a guild
   */
  get(guildId: string): VoiceConnection | undefined {
    return this.connections.get(guildId);
  }

  /**
   * Check if connected to a guild
   */
  has(guildId: string): boolean {
    return this.connections.has(guildId);
  }

  /**
   * Delete a voice connection
   */
  delete(guildId: string): void {
    this.connections.delete(guildId);
    this.pendingConnections.delete(guildId);
  }

  /**
   * Clear all connections
   */
  clear(): void {
    this.connections.clear();
    this.pendingConnections.clear();
  }

  /**
   * Setup Discord voice state handlers
   */
  private setupVoiceHandlers(): void {
    this.client.on("raw", async (packet: { t: string; d: unknown }) => {
      if (packet.t === GatewayDispatchEvents.VoiceStateUpdate) {
        const data = packet.d as GatewayVoiceStateUpdateDispatchData;
        
        // Only handle our own voice state
        if (data.user_id !== this.client.user?.id) return;

        const connection = this.connections.get(data.guild_id!);
        if (connection) {
          connection.sessionId = data.session_id;
          
          // If we have all the info, update the player
          if (connection.token && connection.endpoint) {
            await this.updateVoiceState(data.guild_id!);
          }
        }
      }

      if (packet.t === GatewayDispatchEvents.VoiceServerUpdate) {
        const data = packet.d as GatewayVoiceServerUpdateDispatchData;
        
        const connection = this.connections.get(data.guild_id);
        if (connection) {
          connection.token = data.token;
          connection.endpoint = data.endpoint ?? undefined;
          
          // Update the player with voice info
          await this.updateVoiceState(data.guild_id);
        }
      }
    });
  }

  /**
   * Update Lavalink with voice connection info
   */
  private async updateVoiceState(guildId: string): Promise<void> {
    const connection = this.connections.get(guildId);
    if (!connection?.token || !connection.endpoint) return;

    const node = this.getNode();
    if (!node) return;

    try {
      await node.joinChannel(guildId, {
        token: connection.token,
        endpoint: connection.endpoint,
        sessionId: connection.sessionId,
      });

      // Resolve any pending connection promise
      const pending = this.pendingConnections.get(guildId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve();
        this.pendingConnections.delete(guildId);
      }
    } catch (error) {
      this.logger.error(`Failed to update voice state for ${guildId}:`, error);
      
      const pending = this.pendingConnections.get(guildId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.reject(error as Error);
        this.pendingConnections.delete(guildId);
      }
    }
  }

  /**
   * Connect to a voice channel
   */
  async connect(guildId: string, channelId: string): Promise<void> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error("Guild not found");
    }

    // Store connection info
    this.connections.set(guildId, {
      guildId,
      channelId,
      sessionId: "",
    });

    // Create a promise that resolves when we receive voice server update
    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingConnections.delete(guildId);
        reject(new Error("Voice connection timed out"));
      }, 15000);

      this.pendingConnections.set(guildId, { resolve, reject, timeout });
    });

    // Tell Discord to connect us to the voice channel
    await guild.shard.send({
      op: 4, // VOICE_STATE_UPDATE
      d: {
        guild_id: guildId,
        channel_id: channelId,
        self_mute: false,
        self_deaf: true,
      },
    });

    // Wait for voice connection to be established
    await connectionPromise;
  }

  /**
   * Disconnect from voice
   */
  async disconnect(guildId: string): Promise<void> {
    const guild = this.client.guilds.cache.get(guildId);
    if (guild) {
      await guild.shard.send({
        op: 4,
        d: {
          guild_id: guildId,
          channel_id: null,
          self_mute: false,
          self_deaf: false,
        },
      });
    }

    const node = this.getNode();
    if (node) {
      try {
        await node.leaveChannel(guildId);
      } catch {
        // Ignore errors when leaving
      }
    }

    this.delete(guildId);
  }
}
