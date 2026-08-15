import { PropsWithChildren, useEffect, useRef } from "react";
import { PostHogProvider, usePostHog } from "posthog-react-native";

import { mobileEnv } from "../config/env";
import { useAppShellStore, useCurrentUser } from "../state/app-shell";

export {
  useAnalytics,
  type AnalyticsTrackPayload,
} from "../hooks/useAnalytics";

export function AnalyticsProvider({ children }: PropsWithChildren) {
  return (
    <PostHogProvider
      apiKey={mobileEnv.posthogKey}
      autocapture={{
        captureScreens: false,
        captureTouches: false,
      }}
      options={{
        captureAppLifecycleEvents: !mobileEnv.enableE2ETestMode,
        disabled: mobileEnv.enableE2ETestMode,
        host: mobileEnv.posthogHost,
        personProfiles: "identified_only",
      }}
    >
      <PostHogIdentitySync />
      {children}
    </PostHogProvider>
  );
}

function PostHogIdentitySync() {
  const posthog = usePostHog();
  const currentUser = useCurrentUser();
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const previousSupabaseUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog || mobileEnv.enableE2ETestMode) {
      previousSupabaseUserIdRef.current = null;
      return;
    }

    const currentSupabaseUserId =
      currentUser?.provider === "supabase" ? currentUser.id : null;

    if (
      currentSupabaseUserId &&
      previousSupabaseUserIdRef.current !== currentSupabaseUserId
    ) {
      posthog.identify(currentSupabaseUserId, {
        auth_mode: currentUser?.provider ?? null,
        category: preferredCategory,
        email: currentUser?.email ?? null,
        full_name: currentUser?.fullName ?? null,
        locale: preferredLocale,
      });
    }

    if (!currentSupabaseUserId && previousSupabaseUserIdRef.current) {
      posthog.reset();
    }

    previousSupabaseUserIdRef.current = currentSupabaseUserId;
  }, [currentUser, posthog, preferredCategory, preferredLocale]);

  return null;
}
