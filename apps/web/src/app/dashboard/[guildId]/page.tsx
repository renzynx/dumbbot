import { dehydrate } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { serverApi } from "@/lib/api-server";
import { HydrateClient } from "@/lib/hydrate-client";
import { getQueryClient } from "@/lib/query-client-server";
import { authKeys, playlistKeys } from "@/lib/query-keys";
import { GuildDashboardContent } from "./client";

interface GuildDashboardPageProps {
  params: Promise<{ guildId: string }>;
}

export default async function GuildDashboardPage({
  params,
}: GuildDashboardPageProps) {
  const { guildId } = await params;
  const queryClient = getQueryClient();

  const user = await queryClient.fetchQuery({
    queryKey: authKeys.user(),
    queryFn: async () => {
      const { data, error } = await serverApi.getMe();
      if (error) {
        if (error.status === 401) {
          return null;
        }
        throw new Error(error.error);
      }
      return data;
    },
  });

  if (!user) {
    redirect("/login");
  }

  const guild = user.guilds?.find((g) => g.id === guildId);

  if (!guild) {
    redirect("/dashboard");
  }

  await queryClient.prefetchQuery({
    queryKey: playlistKeys.list(guildId),
    queryFn: async () => {
      const { data, error } = await serverApi.getPlaylists(guildId);
      console.log(error);
      if (error) throw new Error(error.error);
      return data?.playlists ?? [];
    },
  });

  return (
    <HydrateClient state={dehydrate(queryClient)}>
      <GuildDashboardContent guildId={guildId} />
    </HydrateClient>
  );
}
