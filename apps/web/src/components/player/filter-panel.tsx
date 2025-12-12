"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useFilterPresets,
  useApplyFilter,
  useClearFilter,
} from "@/hooks/use-filters";
import { X, SlidersHorizontal, Zap, Music, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  guildId: string;
  isOpen: boolean;
  onClose: () => void;
  disabled?: boolean;
}

// Icons for different filter types
const filterIcons: Record<string, typeof Zap> = {
  nightcore: Zap,
  vaporwave: Music,
  bass: SlidersHorizontal,
  treble: SlidersHorizontal,
  "8d": Sparkles,
  karaoke: Music,
  vibrato: Sparkles,
  tremolo: Sparkles,
  lowpass: SlidersHorizontal,
  slowed: Music,
  speed: Zap,
  chipmunk: Zap,
  darth: Music,
  soft: Sparkles,
};

export function FilterPanel({
  guildId,
  isOpen,
  onClose,
  disabled = false,
}: FilterPanelProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const { data: presets, isLoading, error } = useFilterPresets(guildId);
  const applyFilter = useApplyFilter(guildId);
  const clearFilter = useClearFilter(guildId);

  const handleApplyFilter = (presetId: string) => {
    if (activeFilter === presetId) {
      // Toggle off
      clearFilter.mutate(undefined, {
        onSuccess: () => setActiveFilter(null),
      });
    } else {
      // Apply new filter
      applyFilter.mutate(presetId, {
        onSuccess: () => setActiveFilter(presetId),
      });
    }
  };

  const handleClearAll = () => {
    clearFilter.mutate(undefined, {
      onSuccess: () => setActiveFilter(null),
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Close button outside panel */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-full"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      <div
        className="relative w-full max-w-2xl h-[80vh] bg-gradient-to-b from-card to-background rounded-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded bg-secondary flex items-center justify-center shrink-0">
              <SlidersHorizontal className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-foreground font-semibold">Audio Filters</h2>
              <p className="text-muted-foreground text-sm">
                {activeFilter
                  ? `Active: ${presets?.find((p) => p.id === activeFilter)?.name ?? activeFilter}`
                  : "Select a filter preset"}
              </p>
            </div>
          </div>
          {activeFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={clearFilter.isPending || disabled}
            >
              Clear Filter
            </Button>
          )}
        </div>

        {/* Filter content */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-6">
            {isLoading ? (
              <FilterLoadingSkeleton />
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <AlertCircle className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-xl text-muted-foreground">Failed to load filters</p>
                <p className="text-sm text-muted-foreground/70 mt-2">
                  Please try again later
                </p>
              </div>
            ) : presets && presets.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {presets.map((preset) => {
                  const Icon = filterIcons[preset.id] ?? SlidersHorizontal;
                  const isActive = activeFilter === preset.id;
                  const isPending =
                    (applyFilter.isPending && applyFilter.variables === preset.id) ||
                    (clearFilter.isPending && isActive);

                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyFilter(preset.id)}
                      disabled={applyFilter.isPending || clearFilter.isPending || disabled}
                      className={cn(
                        "relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200",
                        "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-foreground"
                      )}
                    >
                      {isPending ? (
                        <div className="h-6 w-6 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      ) : (
                        <Icon className="h-6 w-6" />
                      )}
                      <span className="font-medium text-sm">{preset.name}</span>
                      <span className="text-xs text-muted-foreground text-center line-clamp-2">
                        {preset.description}
                      </span>
                      {isActive && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <SlidersHorizontal className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-xl text-muted-foreground">No filters available</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {activeFilter && (
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background to-transparent pointer-events-none">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Filter active</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterLoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-28 rounded-lg bg-secondary"
        />
      ))}
    </div>
  );
}
