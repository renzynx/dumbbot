import { json, type RouteHandler } from "@/api/server";

/**
 * GET /api/bot/invite
 * Returns the bot invite URL with required permissions
 */
export const GET: RouteHandler = (ctx) => {
  const clientId = ctx.client.user?.id;

  if (!clientId) {
    return json({ error: "Bot not ready" }, 503);
  }

  // Bot permissions for music bot functionality
  const permissions = [
    "SendMessages",
    "EmbedLinks",
    "Connect",
    "Speak",
    "UseVAD",
  ].join("+");

  // Permission integer for: Send Messages, Embed Links, Connect, Speak, Use VAD
  // 2048 + 16384 + 1048576 + 2097152 + 33554432 = 36716560
  const permissionInt = 36716560;

  const params = new URLSearchParams({
    client_id: clientId,
    permissions: String(permissionInt),
    scope: "bot applications.commands",
  });

  const inviteUrl = `https://discord.com/oauth2/authorize?${params}`;

  return json({
    clientId,
    inviteUrl,
    permissions: permissionInt,
  });
};
