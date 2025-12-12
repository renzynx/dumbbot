import { SlashCommandBuilder  } from "discord.js";
import { Command } from "@/core/Command";
import type { BotClient } from "@/core/Client";
import type { CommandContext } from "@/core/Context";
import { SlashCommand, GuildOnly } from "@/decorators";

@SlashCommand("voteskip", "Vote to skip the current song")
@GuildOnly()
export class VoteSkipCommand extends Command {
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

    const guildSettings = music.settings.get(ctx.guild!.id);
    
    // Check if vote skip is enabled
    if (!guildSettings.voteSkipEnabled) {
      await ctx.reply({
        embeds: [ctx.info("Vote skip is not enabled in this server. Use `/skip` instead or ask an admin to enable it with `/settings voteskip`.")],
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

    // Check if user is in voice channel
    const member = ctx.member;
    if (!member?.voice.channel) {
      await ctx.reply({
        embeds: [ctx.error("You need to be in a voice channel to vote!")],
        ephemeral: true,
      });
      return;
    }

    // Check if user is in the same voice channel
    const botVoiceChannel = music.voiceConnections.get(ctx.guild!.id)?.channelId;
    if (botVoiceChannel && member.voice.channel.id !== botVoiceChannel) {
      await ctx.reply({
        embeds: [ctx.error("You need to be in the same voice channel as me!")],
        ephemeral: true,
      });
      return;
    }

    const result = await music.voteSkip(ctx.guild!.id, ctx.user.id);

    if (!result.success) {
      await ctx.reply({
        embeds: [ctx.error("Failed to process vote.")],
        ephemeral: true,
      });
      return;
    }

    if (result.alreadyVoted) {
      await ctx.reply({
        embeds: [ctx.info(`You already voted! **${result.current}/${result.required}** votes needed to skip.`)],
        ephemeral: true,
      });
      return;
    }

    if (result.skipped) {
      await ctx.reply({
        embeds: [ctx.success(`Vote threshold reached! Skipping **${queue.current?.track.info.title}**...`)],
      });
    } else {
      await ctx.reply({
        embeds: [ctx.success(`Vote added! **${result.current}/${result.required}** votes needed to skip.`)],
      });
    }
  }
}
