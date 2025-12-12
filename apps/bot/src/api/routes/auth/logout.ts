import { type RouteHandler } from "@/api/server";
import { getSessionToken } from "@/api/middleware/auth";
import { deleteSession } from "@/db/sessions";

/**
 * POST /api/auth/logout
 * Logout and clear session from database
 */
export const POST: RouteHandler = async (ctx) => {
  const token = getSessionToken(ctx.req);

  if (token) {
    await deleteSession(token);
  }

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  const isSecure = frontendUrl.startsWith("https");
  const cookieDomain = process.env.COOKIE_DOMAIN;

  const cookieParts = [
    "session=",
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    `SameSite=${isSecure ? "None" : "Lax"}`,
  ];

  if (isSecure) cookieParts.push("Secure");
  if (cookieDomain) cookieParts.push(`Domain=${cookieDomain}`);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieParts.join("; "),
    },
  });
};
