"use client";

import { RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GuildCard } from "@/components/guild-card";
import { useAuth } from "@/hooks/use-auth";
import { botApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function DashboardContent() {
  const { user, guilds, logout, refreshGuilds, isRefreshingGuilds } = useAuth();

  const { data: inviteData } = useQuery({
    queryKey: ["bot-invite"],
    queryFn: async () => {
      const res = await botApi.getInvite();
      return res.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold">MusicBot Dashboard</h1>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl} alt={user?.username} />
                <AvatarFallback>
                  {user?.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {user?.username}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Your Servers</h2>
            <p className="mt-1 text-muted-foreground">
              Select a server to control its music queue
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshGuilds()}
            disabled={isRefreshingGuilds}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshingGuilds ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {guilds.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <p className="text-muted-foreground">
                No servers found where the bot is installed.
              </p>
              <Button asChild disabled={!inviteData?.inviteUrl}>
                <a
                  href={inviteData?.inviteUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Add Bot to Server
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guilds.map((guild) => (
              <GuildCard key={guild.id} guild={guild} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
