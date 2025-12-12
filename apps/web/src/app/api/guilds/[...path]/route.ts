import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

/**
 * Proxy handler for all guild-related API requests
 * Routes: /api/guilds/[guildId]/player/*, /api/guilds/[guildId]/queue/*
 */
async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const backendPath = `/api/guilds/${path.join("/")}`;
  const backendUrl = new URL(backendPath, API_URL);

  // Forward query params
  request.nextUrl.searchParams.forEach((value, key) => {
    backendUrl.searchParams.set(key, value);
  });

  // Build headers to forward
  const headers: HeadersInit = {};
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  // Forward the request to the backend
  const backendResponse = await fetch(backendUrl.toString(), {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD" 
      ? await request.text() 
      : undefined,
  });

  // Get response data
  const responseData = await backendResponse.text();

  // Create response with same status and forward relevant headers
  const response = new NextResponse(responseData, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
  });

  // Forward content-type header
  const responseContentType = backendResponse.headers.get("content-type");
  if (responseContentType) {
    response.headers.set("Content-Type", responseContentType);
  }

  // Forward Set-Cookie if present
  const setCookie = backendResponse.headers.get("set-cookie");
  if (setCookie) {
    response.headers.set("Set-Cookie", setCookie);
  }

  return response;
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
