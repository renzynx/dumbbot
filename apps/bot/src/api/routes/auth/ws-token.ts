import { json, type RouteHandler, type Middleware } from "@/api/server";
import { requireAuth } from "@/api/middleware/auth";
import { createWSToken } from "@/db/sessions";

export const middleware: Middleware[] = [requireAuth];

export const GET: RouteHandler = async (ctx) => {
  const userId = ctx.user!.id;
  const token = createWSToken(userId);

  return json({ token });
};
