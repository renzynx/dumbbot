import { cookies } from "next/headers";
import type { User } from "./api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ApiError {
  error: string;
  status: number;
}

interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export async function serverFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  const url = `${API_BASE_URL}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(sessionCookie && { Cookie: `session=${sessionCookie.value}` }),
      ...options.headers,
    },
    cache: "no-store",
  };

  try {
    const response = await fetch(url, config);

    if (response.status === 204) {
      return { data: null, error: null };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: {
          error: data.error ?? "Unknown error",
          status: response.status,
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        error: err instanceof Error ? err.message : "Network error",
        status: 0,
      },
    };
  }
}

/**
 * Server-side API methods
 */
export const serverApi = {
  getMe: () => serverFetch<User>("/api/auth/me"),

  getPlaylists: (guildId: string) =>
    serverFetch<{
      playlists: Array<{
        id: string;
        name: string;
        ownerId: string;
        ownerName: string;
        isPublic: boolean;
        trackCount: number;
        duration: number;
        createdAt: string;
        updatedAt: string;
      }>;
    }>(`/api/guilds/${guildId}/playlists`),
};
