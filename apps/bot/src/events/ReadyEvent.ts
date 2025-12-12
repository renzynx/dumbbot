import { Events, ActivityType, type Client } from "discord.js";
import { Event } from "@/core/Event";
import type { BotClient } from "@/core/Client";

export class ReadyEvent extends Event<typeof Events.ClientReady> {
  constructor(client: BotClient) {
    super(client, {
      name: Events.ClientReady,
      once: true,
    });
  }

  execute(readyClient: Client<true>): void {
    this.client.logger.success(`Ready! Logged in as ${readyClient.user.tag}`);
    this.client.logger.info(`Serving ${readyClient.guilds.cache.size} guilds`);

    // Set bot activity
    readyClient.user.setActivity({
      name: "/help",
      type: ActivityType.Listening,
    });
  }
}
