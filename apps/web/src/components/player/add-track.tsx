"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Loader2 } from "lucide-react";

interface AddTrackProps {
  onAdd: (query: string) => void;
  isLoading?: boolean;
}

export function AddTrack({ onAdd, isLoading }: AddTrackProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onAdd(query.trim());
      setQuery("");
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search or paste a URL..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={!query.trim() || isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Add</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
