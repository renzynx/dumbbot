// Re-export shared types
export type {
	ApiError,
	ApiResponse,
	ApplyFilterResponse,
	ClearFilterResponse,
	FilterPreset,
	FilterPresetsResponse,
	Guild,
	GuildSettings,
	LoopMode,
	LyricsResult,
	ParsedLyricLine,
	PlayerState,
	Playlist,
	PlaylistWithTracks,
	QueueResponse,
	SearchSuggestion,
	Track,
	User,
} from "@discordbot/shared-types";

import type {
	ApiResponse,
	ApplyFilterResponse,
	ClearFilterResponse,
	FilterPresetsResponse,
	Guild,
	LoopMode,
	LyricsResult,
	ParsedLyricLine,
	PlayerState,
	Playlist,
	PlaylistWithTracks,
	QueueResponse,
	Track,
	User,
} from "@discordbot/shared-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Type-safe fetch wrapper for API calls
 */
async function request<T>(
	endpoint: string,
	options: RequestInit = {},
): Promise<ApiResponse<T>> {
	const url = `${API_BASE_URL}${endpoint}`;

	const config: RequestInit = {
		...options,
		credentials: "include", // Always include cookies for session auth
		headers: {
			"Content-Type": "application/json",
			...options.headers,
		},
	};

	try {
		const response = await fetch(url, config);

		// Handle no content responses
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

export const api = {
	get: <T>(endpoint: string, options?: RequestInit) =>
		request<T>(endpoint, { ...options, method: "GET" }),

	post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
		request<T>(endpoint, {
			...options,
			method: "POST",
			body: body ? JSON.stringify(body) : undefined,
		}),

	put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
		request<T>(endpoint, {
			...options,
			method: "PUT",
			body: body ? JSON.stringify(body) : undefined,
		}),

	patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
		request<T>(endpoint, {
			...options,
			method: "PATCH",
			body: body ? JSON.stringify(body) : undefined,
		}),

	delete: <T>(endpoint: string, options?: RequestInit) =>
		request<T>(endpoint, { ...options, method: "DELETE" }),
};

// ============================================
// Auth API Methods
// ============================================

export const authApi = {
	getLoginUrl: () => `${API_BASE_URL}/api/auth/discord`,

	exchangeCode: (code: string, state: string) =>
		api.post<{ success: boolean; user: User }>("/api/auth/callback", {
			code,
			state,
		}),

	getMe: () => api.get<User>("/api/auth/me"),

	refreshGuilds: () =>
		api.post<{ success: boolean; guilds: Guild[] }>("/api/auth/refresh-guilds"),

	logout: () => api.post<{ success: boolean }>("/api/auth/logout"),
};

// ============================================
// Player API Methods
// ============================================

export const playerApi = {
	/**
	 * Get player state for a guild
	 */
	getState: (guildId: string) =>
		api.get<PlayerState>(`/api/guilds/${guildId}/player`),

	/**
	 * Play a track or resume playback
	 */
	play: (guildId: string, query?: string) =>
		api.post<{ success: boolean; track?: Track }>(
			`/api/guilds/${guildId}/player/play`,
			query ? { query } : undefined,
		),

	/**
	 * Pause playback
	 */
	pause: (guildId: string) =>
		api.post<{ success: boolean }>(`/api/guilds/${guildId}/player/pause`),

	/**
	 * Skip current track
	 */
	skip: (guildId: string) =>
		api.post<{ success: boolean; skipped?: Track }>(
			`/api/guilds/${guildId}/player/skip`,
		),

	/**
	 * Stop playback and clear queue
	 */
	stop: (guildId: string) =>
		api.post<{ success: boolean }>(`/api/guilds/${guildId}/player/stop`),

	/**
	 * Seek to position in current track
	 */
	seek: (guildId: string, position: number) =>
		api.post<{ success: boolean; position: number }>(
			`/api/guilds/${guildId}/player/seek`,
			{ position },
		),

	/**
	 * Set volume (0-100)
	 */
	setVolume: (guildId: string, volume: number) =>
		api.patch<{ success: boolean; volume: number }>(
			`/api/guilds/${guildId}/player/volume`,
			{ volume },
		),

	/**
	 * Set loop mode
	 */
	setLoop: (guildId: string, mode: LoopMode) =>
		api.patch<{ success: boolean; loop: string }>(
			`/api/guilds/${guildId}/player/loop`,
			{ mode },
		),

	/**
	 * Shuffle the queue
	 */
	shuffle: (guildId: string) =>
		api.post<{ success: boolean; queue: Track[] }>(
			`/api/guilds/${guildId}/player/shuffle`,
		),

	/**
	 * Get playback history
	 */
	getHistory: (guildId: string, limit?: number) => {
		const query = limit ? `?limit=${limit}` : "";
		return api.get<{ history: Track[] }>(
			`/api/guilds/${guildId}/player/history${query}`,
		);
	},
};

// ============================================
// Queue API Methods
// ============================================

export const queueApi = {
	/**
	 * Get the current queue
	 */
	get: (guildId: string) =>
		api.get<QueueResponse>(`/api/guilds/${guildId}/queue`),

	/**
	 * Add a track to the queue
	 */
	add: (guildId: string, query: string) =>
		api.post<{
			success: boolean;
			track?: Track;
			playlist?: { name: string; tracks: Track[] };
		}>(`/api/guilds/${guildId}/queue`, { query }),

	/**
	 * Clear the queue
	 */
	clear: (guildId: string) =>
		api.delete<{ success: boolean }>(`/api/guilds/${guildId}/queue`),

	/**
	 * Remove a track from the queue
	 */
	remove: (guildId: string, position: number) =>
		api.delete<{ success: boolean; removed: Track }>(
			`/api/guilds/${guildId}/queue/${position}`,
		),

	/**
	 * Move a track in the queue
	 */
	move: (guildId: string, from: number, to: number) =>
		api.patch<{ success: boolean; queue: Track[] }>(
			`/api/guilds/${guildId}/queue/move`,
			{ from, to },
		),
};

// ============================================
// Lyrics API (lrclib.net)
// ============================================

/**
 * Parse LRC format synced lyrics into array of timed lines
 */
export function parseSyncedLyrics(lrc: string): ParsedLyricLine[] {
	const lines: ParsedLyricLine[] = [];
	const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;

	let match: RegExpExecArray | null;
	while ((match = regex.exec(lrc)) !== null) {
		const minutes = parseInt(match[1], 10);
		const seconds = parseInt(match[2], 10);
		// Handle both 2-digit (centiseconds) and 3-digit (milliseconds) formats
		const ms =
			match[3].length === 2
				? parseInt(match[3], 10) * 10
				: parseInt(match[3], 10);

		const time = minutes * 60 * 1000 + seconds * 1000 + ms;
		const text = match[4].trim();

		if (text) {
			lines.push({ time, text });
		}
	}

	return lines.sort((a, b) => a.time - b.time);
}

export const lyricsApi = {
	/**
	 * Search for lyrics by track name and artist
	 */
	search: async (
		trackName: string,
		artistName: string,
		duration?: number,
	): Promise<LyricsResult | null> => {
		try {
			const params = new URLSearchParams({
				track_name: trackName,
				artist_name: artistName,
			});

			if (duration) {
				// lrclib expects duration in seconds
				params.set("duration", Math.floor(duration / 1000).toString());
			}

			const response = await fetch(
				`https://lrclib.net/api/get?${params.toString()}`,
				{
					headers: {
						"Content-Type": "application/json",
					},
				},
			);

			if (!response.ok) {
				if (response.status === 404) {
					return null;
				}
				throw new Error(`Failed to fetch lyrics: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Lyrics search error:", error);
			return null;
		}
	},

	/**
	 * Search for lyrics with multiple results
	 */
	searchAll: async (query: string): Promise<LyricsResult[]> => {
		try {
			const response = await fetch(
				`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`,
				{
					headers: {
						"Content-Type": "application/json",
					},
				},
			);

			if (!response.ok) {
				throw new Error(`Failed to search lyrics: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Lyrics search error:", error);
			return [];
		}
	},
};

// ============================================
// Playlist API Methods
// ============================================

export const playlistApi = {
	/**
	 * Get all playlists for a guild
	 */
	getAll: (guildId: string) =>
		api.get<{ playlists: Playlist[] }>(`/api/guilds/${guildId}/playlists`),

	/**
	 * Get a specific playlist with tracks
	 */
	get: (guildId: string, playlistId: string) =>
		api.get<PlaylistWithTracks>(
			`/api/guilds/${guildId}/playlists/${playlistId}`,
		),

	/**
	 * Create a new playlist
	 */
	create: (guildId: string, name: string, description?: string) =>
		api.post<Playlist>(`/api/guilds/${guildId}/playlists`, {
			name,
			description,
		}),

	/**
	 * Delete a playlist
	 */
	delete: (guildId: string, playlistId: string) =>
		api.delete<{ success: boolean }>(
			`/api/guilds/${guildId}/playlists/${playlistId}`,
		),

	/**
	 * Add current queue to a playlist
	 */
	saveQueue: (guildId: string, playlistId: string) =>
		api.post<{ success: boolean; message: string; added: number }>(
			`/api/guilds/${guildId}/playlists/${playlistId}/save-queue`,
		),

	/**
	 * Load playlist into queue
	 */
	load: (guildId: string, playlistId: string) =>
		api.post<{ success: boolean; message: string; addedCount: number }>(
			`/api/guilds/${guildId}/playlists/${playlistId}/load`,
		),
};

// ============================================
// Search Suggestions API
// ============================================

export const searchApi = {
	/**
	 * Get search suggestions from YouTube
	 */
	getSuggestions: async (query: string): Promise<string[]> => {
		if (!query.trim()) return [];

		try {
			// Use YouTube's suggestion API via a proxy to avoid CORS
			const response = await fetch(
				`/api/search/suggestions?q=${encodeURIComponent(query)}`,
			);

			if (!response.ok) {
				return [];
			}

			const data = await response.json();
			return data.suggestions ?? [];
		} catch (error) {
			console.error("Search suggestions error:", error);
			return [];
		}
	},
};

// ============================================
// Filters API Methods
// ============================================

export const filtersApi = {
	/**
	 * Get available filter presets
	 */
	getPresets: (guildId: string) =>
		api.get<FilterPresetsResponse>(`/api/guilds/${guildId}/player/filters`),

	/**
	 * Apply a filter preset
	 */
	apply: (guildId: string, preset: string) =>
		api.post<ApplyFilterResponse>(`/api/guilds/${guildId}/player/filters`, {
			preset,
		}),

	/**
	 * Clear all filters
	 */
	clear: (guildId: string) =>
		api.delete<ClearFilterResponse>(`/api/guilds/${guildId}/player/filters`),
};
