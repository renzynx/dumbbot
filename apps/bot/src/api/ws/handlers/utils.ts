import type { WSContext } from "@/api/server";
import { LoopMode } from "@/music/Queue";
import { formatTrack } from "@/api/routes/guilds/[guildId]/helpers";

// Helper to send error response
export function sendError(ctx: WSContext, message: string) {
  ctx.ws.send(JSON.stringify({ type: "error", message }));
}

// Helper to send success response
export function sendSuccess(ctx: WSContext, data?: Record<string, unknown>) {
  ctx.ws.send(JSON.stringify({ type: "success", ...data }));
}

// Helper to broadcast player update to all subscribers
export function broadcastPlayerUpdate(ctx: WSContext, guildId: string) {
  const music = ctx.client.music;
  if (!music) return;

  const queue = music.queues.get(guildId);
  const node = music.getIdealNode();
  const player = node?.getPlayer(guildId);
  const settings = music.settings.get(guildId);

  ctx.server.broadcastToGuild(guildId, {
    type: "playerUpdate",
    data: {
      playing: !!queue?.current,
      current: queue?.current ? formatTrack(queue.current) : null,
      queue: queue?.tracks.map((t) => formatTrack(t)) ?? [],
      position: player?.state.position ?? 0,
      volume: queue?.volume ?? settings.defaultVolume,
      loopMode: queue?.loopMode ?? LoopMode.None,
      paused: player?.paused ?? false,
      settings: {
        defaultVolume: settings.defaultVolume,
        djOnlyMode: settings.djOnlyMode,
        twentyFourSevenMode: settings.twentyFourSevenMode,
        autoplayEnabled: settings.autoplayEnabled,
        voteSkipEnabled: settings.voteSkipEnabled,
        voteSkipPercentage: settings.voteSkipPercentage,
      },
    },
  });
}

// Helper to require authentication
export function requireAuth(ctx: WSContext): string | null {
  const userId = ctx.ws.data.userId;
  if (!userId) {
    sendError(ctx, "Authentication required");
    return null;
  }
  return userId;
}

// Helper to require guild subscription
export function requireGuild(ctx: WSContext): string | null {
  const guildId = ctx.ws.data.guildId;
  if (!guildId) {
    sendError(ctx, "Must be subscribed to a guild");
    return null;
  }
  return guildId;
}

// Helper to require music system
export function requireMusic(ctx: WSContext) {
  const music = ctx.client.music;
  if (!music) {
    sendError(ctx, "Music system not available");
    return null;
  }
  return music;
}

/**
 * Check if user has DJ permissions
 * Returns true if user can proceed, false if they don't have permission
 */
export function requireDJPermissions(ctx: WSContext, guildId: string, userId: string): boolean {
  const music = ctx.client.music;
  if (!music) return false;

  const hasDJ = music.hasDJPermissions(guildId, userId);
  if (!hasDJ) {
    sendError(ctx, "DJ role required to use this command");
    return false;
  }
  return true;
}

/**
 * Handle vote skip logic
 * Returns { canSkip, message } - canSkip is true if the skip should proceed
 */
export async function handleVoteSkip(
  ctx: WSContext,
  guildId: string,
  userId: string
): Promise<{ canSkip: boolean; message?: string }> {
  const music = ctx.client.music;
  if (!music) return { canSkip: false };

  const settings = music.settings.get(guildId);

  // If vote skip is not enabled, allow direct skip (if user has DJ permissions)
  if (!settings.voteSkipEnabled) {
    return { canSkip: true };
  }

  // If user has DJ permissions, they can skip directly
  if (music.hasDJPermissions(guildId, userId)) {
    return { canSkip: true };
  }

  // Otherwise, process vote skip
  const result = await music.voteSkip(guildId, userId);

  if (!result.success) {
    return { canSkip: false, message: "Nothing is playing" };
  }

  if (result.alreadyVoted) {
    return {
      canSkip: false,
      message: `You already voted! (${result.current}/${result.required} votes)`,
    };
  }

  if (result.skipped) {
    return { canSkip: false, message: "Vote skip passed! Skipping..." };
  }

  return {
    canSkip: false,
    message: `Vote added! (${result.current}/${result.required} votes needed)`,
  };
}
