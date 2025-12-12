/**
 * Standard API error response
 */
export interface ApiError {
  error: string;
  status: number;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

/**
 * Success response for mutations
 */
export interface SuccessResponse {
  success: boolean;
  message?: string;
}
