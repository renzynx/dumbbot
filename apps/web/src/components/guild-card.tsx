"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { Guild } from "@/lib/api";

interface GuildCardProps {
  guild: Guild;
}

export function GuildCard({ guild }: GuildCardProps) {
  return (
    <Link href={`/dashboard/${guild.id}`}>
      <Card className="group transition-colors hover:border-primary/50 hover:bg-accent/50">
        <CardContent className="flex items-center gap-4 p-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={guild.iconUrl ?? undefined} alt={guild.name} />
            <AvatarFallback className="text-lg">
              {guild.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium transition-colors group-hover:text-primary">
              {guild.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {guild.hasBot ? "Bot connected" : "Bot not connected"}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
