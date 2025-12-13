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
	LyricsResult,
	ParsedLyricLine,
	Playlist,
	PlaylistWithTracks,
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

	/** Get a short-lived token for WebSocket authentication */
	getWSToken: () => api.get<{ token: string }>("/api/auth/ws-token"),
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

/**
 * Calculate string similarity using Levenshtein distance (0-1, higher is better)
 */
function stringSimilarity(a: string, b: string): number {
	const aLower = a.toLowerCase().trim();
	const bLower = b.toLowerCase().trim();

	if (aLower === bLower) return 1;
	if (aLower.length === 0 || bLower.length === 0) return 0;

	// Simple containment check for partial matches
	if (aLower.includes(bLower) || bLower.includes(aLower)) {
		return 0.8;
	}

	// Levenshtein distance
	const matrix: number[][] = [];
	for (let i = 0; i <= bLower.length; i++) {
		matrix[i] = [i];
	}
	for (let j = 0; j <= aLower.length; j++) {
		matrix[0][j] = j;
	}
	for (let i = 1; i <= bLower.length; i++) {
		for (let j = 1; j <= aLower.length; j++) {
			if (bLower[i - 1] === aLower[j - 1]) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1,
					matrix[i][j - 1] + 1,
					matrix[i - 1][j] + 1,
				);
			}
		}
	}

	const maxLen = Math.max(aLower.length, bLower.length);
	return 1 - matrix[bLower.length][aLower.length] / maxLen;
}

/**
 * Calculate duration similarity (0-1, higher is better)
 * Allows 5 second tolerance for exact match
 */
function durationSimilarity(a: number, b: number): number {
	if (a === 0 || b === 0) return 0.5; // Unknown duration, neutral score
	const diff = Math.abs(a - b);
	if (diff <= 5) return 1; // Within 5 seconds is perfect
	if (diff <= 15) return 0.8; // Within 15 seconds is good
	if (diff <= 30) return 0.5; // Within 30 seconds is acceptable
	return Math.max(0, 1 - diff / 120); // Gradual falloff
}

/**
 * Find the best matching lyrics result from search results
 */
function findBestMatch(
	results: LyricsResult[],
	trackName: string,
	artistName: string,
	durationMs?: number,
): LyricsResult | null {
	if (results.length === 0) return null;

	const durationSec = durationMs ? Math.floor(durationMs / 1000) : 0;

	let bestMatch: LyricsResult | null = null;
	let bestScore = -1;

	for (const result of results) {
		// Skip results without lyrics
		if (!result.syncedLyrics && !result.plainLyrics) continue;

		const titleScore = stringSimilarity(trackName, result.trackName);
		const artistScore = stringSimilarity(artistName, result.artistName);
		const durationScore = durationSec
			? durationSimilarity(durationSec, result.duration)
			: 0.5;

		// Weighted score: title is most important, then artist, then duration
		// Bonus for having synced lyrics
		const syncedBonus = result.syncedLyrics ? 0.1 : 0;
		const score =
			titleScore * 0.4 + artistScore * 0.35 + durationScore * 0.25 + syncedBonus;

		if (score > bestScore) {
			bestScore = score;
			bestMatch = result;
		}
	}

	// Only return if we have a reasonable match (score > 0.4)
	return bestScore > 0.4 ? bestMatch : null;
}

export const lyricsApi = {
	/**
	 * Search for lyrics by track name and artist, finding the best match
	 */
	search: async (
		trackName: string,
		artistName: string,
		duration?: number,
	): Promise<LyricsResult | null> => {
		try {
			if (!trackName.trim()) return null;

			// Use track_name and artist_name params for more accurate search
			const params = new URLSearchParams();
			params.set("track_name", trackName.trim());
			if (artistName.trim()) {
				params.set("artist_name", artistName.trim());
			}

			const response = await fetch(
				`https://lrclib.net/api/search?${params.toString()}`,
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
				throw new Error(`Failed to search lyrics: ${response.status}`);
			}

			const results: LyricsResult[] = await response.json();
			return findBestMatch(results, trackName, artistName, duration);
		} catch (error) {
			console.error("Lyrics search error:", error);
			return null;
		}
	},

	/**
	 * Search for lyrics with multiple results using a general query
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
		api.post<{ success: boolean; playlist: Playlist }>(
			`/api/guilds/${guildId}/playlists`,
			{
				name,
				description,
			},
		),

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

	/**
	 * Add a single track to a playlist
	 */
	addTrack: (guildId: string, playlistId: string, track: Track) =>
		api.post<{ success: boolean; message: string; position: number }>(
			`/api/guilds/${guildId}/playlists/${playlistId}/tracks`,
			{
				track: {
					encoded: track.encoded,
					title: track.title,
					author: track.author,
					uri: track.uri,
					duration: track.duration,
					artworkUrl: track.artworkUrl,
				},
			},
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

// ============================================
// Bot API Methods
// ============================================

export interface BotInviteResponse {
	clientId: string;
	inviteUrl: string;
	permissions: number;
}

export const botApi = {
	/**
	 * Get the bot invite URL
	 */
	getInvite: () => api.get<BotInviteResponse>("/api/bot/invite"),
};
