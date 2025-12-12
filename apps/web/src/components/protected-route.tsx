"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { FullPageLoader } from "@/components/ui/loading-spinner";

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Wrapper component that protects routes from unauthenticated users
 * Redirects to login page if not authenticated
 * IMPORTANT: Children are NOT rendered until auth is confirmed to prevent
 * hooks from running before authentication is complete
 */
export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loader while auth is loading
  if (isLoading) {
    return fallback ?? <FullPageLoader />;
  }

  // Don't render children until authenticated - this prevents hooks from running
  if (!isAuthenticated) {
    return fallback ?? <FullPageLoader />;
  }

  return <>{children}</>;
}
