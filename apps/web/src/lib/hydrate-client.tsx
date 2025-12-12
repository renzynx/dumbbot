"use client";

import { HydrationBoundary, type DehydratedState } from "@tanstack/react-query";
import type { ReactNode } from "react";

interface HydrateClientProps {
  children: ReactNode;
  state: DehydratedState;
}

export function HydrateClient({ children, state }: HydrateClientProps) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
