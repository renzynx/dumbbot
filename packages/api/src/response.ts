/**
 * Create a JSON response
 */
export function json(
  data: unknown,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/**
 * Create a redirect response
 */
export function redirect(
  url: string,
  status: 301 | 302 | 307 | 308 = 302
): Response {
  return new Response(null, {
    status,
    headers: { Location: url },
  });
}

/**
 * Create an error JSON response
 */
export function errorResponse(
  message: string,
  status: number = 500,
  headers: Record<string, string> = {}
): Response {
  return json({ error: message }, status, headers);
}

/**
 * Create a not found response
 */
export function notFound(message: string = "Not Found"): Response {
  return json({ error: message }, 404);
}

/**
 * Create an unauthorized response
 */
export function unauthorized(message: string = "Unauthorized"): Response {
  return json({ error: message }, 401);
}

/**
 * Create a forbidden response
 */
export function forbidden(message: string = "Forbidden"): Response {
  return json({ error: message }, 403);
}

/**
 * Create a bad request response
 */
export function badRequest(message: string = "Bad Request"): Response {
  return json({ error: message }, 400);
}
