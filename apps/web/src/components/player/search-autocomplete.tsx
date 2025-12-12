"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useSearchSuggestions } from "@/hooks/use-search-suggestions";
import { Search, Loader2, History, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchAutocompleteProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

const SEARCH_HISTORY_KEY = "music-search-history";
const MAX_HISTORY_ITEMS = 5;

function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}

function addToSearchHistory(query: string): void {
  if (typeof window === "undefined") return;
  try {
    const history = getSearchHistory();
    const filtered = history.filter((item) => item.toLowerCase() !== query.toLowerCase());
    const newHistory = [query, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
  } catch {
    // Ignore storage errors
  }
}

export function SearchAutocomplete({
  onSearch,
  isLoading = false,
  placeholder = "Search or paste a link...",
  className,
}: SearchAutocompleteProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    suggestions,
    isLoading: isSuggestionsLoading,
    query,
    setQuery,
    clearSuggestions,
  } = useSearchSuggestions({ debounceMs: 250 });

  // Load search history on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  // Combined items: history (when empty query) or suggestions
  const displayItems = query.trim()
    ? suggestions.map((s) => ({ text: s, type: "suggestion" as const }))
    : searchHistory.map((s) => ({ text: s, type: "history" as const }));

  const isDropdownOpen = isFocused && displayItems.length > 0;

  const handleSubmit = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    addToSearchHistory(searchQuery.trim());
    setSearchHistory(getSearchHistory());
    onSearch(searchQuery.trim());
    setQuery("");
    clearSuggestions();
    setSelectedIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit(query);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < displayItems.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && displayItems[selectedIndex]) {
          handleSubmit(displayItems[selectedIndex].text);
        } else {
          handleSubmit(query);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsFocused(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleItemClick = (text: string) => {
    handleSubmit(text);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("relative", className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(query);
        }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="pl-10 pr-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-400 focus-visible:ring-white/20"
          />
          {(isLoading || isSuggestionsLoading) && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 animate-spin" />
          )}
        </div>
      </form>

      {/* Dropdown */}
      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden"
        >
          <ul className="py-1">
            {displayItems.map((item, index) => (
              <li key={`${item.type}-${item.text}`}>
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                    selectedIndex === index
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-300 hover:bg-zinc-800/50 hover:text-white"
                  )}
                  onClick={() => handleItemClick(item.text)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {item.type === "history" ? (
                    <History className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                  )}
                  <span className="truncate">{item.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
