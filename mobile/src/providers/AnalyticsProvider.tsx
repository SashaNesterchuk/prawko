import { PropsWithChildren, useEffect, useRef } from "react";
import { PostHogProvider, usePostHog } from "posthog-react-native";

import { ANALYTICS_PROPERTIES } from "../analytics/catalog";
import { mobileEnv } from "../config/env";
import { useAppShellStore, useCurrentUser } from "../state/app-shell";
import { useHasPlusAccess } from "../state/entitlements";

export {
  useAnalytics,
  type AnalyticsTrack,
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
  const isPlus = useHasPlusAccess();
  const examCountry = useAppShellStore((state) => state.examCountry);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const previousIdentitySignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog || mobileEnv.enableE2ETestMode) {
      previousIdentitySignatureRef.current = null;
      return;
    }

    const currentSupabaseUserId =
      currentUser?.provider === "supabase" ? currentUser.id : null;
    const identitySignature = currentSupabaseUserId
      ? [
          currentSupabaseUserId,
          currentUser?.email ?? "",
          currentUser?.fullName ?? "",
          examCountry ?? "",
          preferredCategory,
          preferredLocale,
          String(isPlus),
        ].join("|")
      : null;

    if (
      currentSupabaseUserId &&
      previousIdentitySignatureRef.current !== identitySignature
    ) {
      posthog.identify(currentSupabaseUserId, {
        auth_mode: currentUser?.provider ?? null,
        category: preferredCategory,
        email: currentUser?.email ?? null,
        [ANALYTICS_PROPERTIES.examCountry]: examCountry,
        full_name: currentUser?.fullName ?? null,
        is_plus: isPlus,
        locale: preferredLocale,
      });
    }

    if (!currentSupabaseUserId && previousIdentitySignatureRef.current) {
      posthog.reset();
    }

    previousIdentitySignatureRef.current = identitySignature;
  }, [currentUser, examCountry, isPlus, posthog, preferredCategory, preferredLocale]);

  return null;
}
