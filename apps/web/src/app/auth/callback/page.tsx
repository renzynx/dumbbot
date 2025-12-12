"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { FullPageLoader } from "@/components/ui/loading-spinner";
import { authApi } from "@/lib/api";

/**
 * Auth callback content component
 * Uses useSearchParams which requires Suspense boundary
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle OAuth errors from Discord
    if (oauthError) {
      router.replace(
        `/auth/error?error=${encodeURIComponent(errorDescription ?? oauthError)}`,
      );
      return;
    }

    if (!code || !state) {
      router.replace("/auth/error?error=Missing authorization code or state");
      return;
    }

    // Exchange code for session
    authApi.exchangeCode(code, state).then(({ data, error }) => {
      if (error) {
        setError(error.error);
        router.replace(`/auth/error?error=${encodeURIComponent(error.error)}`);
        return;
      }

      if (data?.success) {
        // Session cookie is set by the response, redirect to dashboard
        router.replace("/dashboard");
      } else {
        router.replace("/auth/error?error=Authentication failed");
      }
    });
  }, [searchParams, router]);

  if (error) {
    return <FullPageLoader message={`Error: ${error}`} />;
  }

  return <FullPageLoader message="Completing sign in..." />;
}

/**
 * Auth callback page
 * Discord redirects here with code and state params
 * We exchange them with the backend for a session
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<FullPageLoader message="Loading..." />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
