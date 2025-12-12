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

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
    },
  });
};
