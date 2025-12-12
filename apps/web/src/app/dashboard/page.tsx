import { dehydrate } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { serverApi } from "@/lib/api-server";
import { HydrateClient } from "@/lib/hydrate-client";
import { getQueryClient } from "@/lib/query-client-server";
import { authKeys } from "@/lib/query-keys";
import { DashboardContent } from "./client";

export default async function DashboardPage() {
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

  return (
    <HydrateClient state={dehydrate(queryClient)}>
      <DashboardContent />
    </HydrateClient>
  );
}
