import { Events, type Guild } from "discord.js";
import { Event } from "@/core/Event";
import type { BotClient } from "@/core/Client";

export class GuildCreateEvent extends Event<typeof Events.GuildCreate> {
  constructor(client: BotClient) {
    super(client, {
      name: Events.GuildCreate,
      once: false,
    });
  }

  execute(guild: Guild): void {
    this.client.logger.info(
      `Joined guild: ${guild.name} (${guild.id}) with ${guild.memberCount} members`
    );
  }
}
