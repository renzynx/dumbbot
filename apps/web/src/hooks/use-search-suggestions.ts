"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { searchApi } from "@/lib/api";

interface UseSearchSuggestionsOptions {
  debounceMs?: number;
  enabled?: boolean;
}

interface UseSearchSuggestionsReturn {
  suggestions: string[];
  isLoading: boolean;
  query: string;
  setQuery: (query: string) => void;
  clearSuggestions: () => void;
}

export function useSearchSuggestions({
  debounceMs = 300,
  enabled = true,
}: UseSearchSuggestionsOptions = {}): UseSearchSuggestionsReturn {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      if (!enabled || !searchQuery.trim()) {
        setSuggestions([]);
        return;
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setIsLoading(true);

      try {
        const results = await searchApi.getSuggestions(searchQuery);
        setSuggestions(results);
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Failed to fetch suggestions:", error);
        }
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [enabled]
  );

  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    // Debounce the API call
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, debounceMs, fetchSuggestions]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    isLoading,
    query,
    setQuery,
    clearSuggestions,
  };
}
