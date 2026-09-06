import { PropsWithChildren, useEffect, useRef } from "react";
import { PostHogProvider, usePostHog } from "posthog-react-native";

import { ANALYTICS_PROPERTIES } from "../analytics/catalog";
import { isPostHogCaptureEnabled } from "../analytics/posthog-build-gate";
import { mobileEnv } from "../config/env";
import { useAppUserId } from "../identity/AppIdentityProvider";
import { useAppShellStore, useCurrentUser } from "../state/app-shell";
import { useHasPlusAccess } from "../state/entitlements";

export {
  useAnalytics,
  type AnalyticsTrack,
  type AnalyticsTrackPayload,
} from "../hooks/useAnalytics";

const POSTHOG_DISABLED_API_KEY = "phc_disabled";

export function AnalyticsProvider({ children }: PropsWithChildren) {
  const posthogEnabled = isPostHogCaptureEnabled();
  const appUserId = useAppUserId();

  return (
    <PostHogProvider
      apiKey={posthogEnabled ? mobileEnv.posthogKey : POSTHOG_DISABLED_API_KEY}
      autocapture={{
        captureScreens: false,
        captureTouches: false,
      }}
      options={{
        bootstrap: {
          distinctId: appUserId,
          isIdentifiedId: true,
        },
        captureAppLifecycleEvents: posthogEnabled,
        disabled: !posthogEnabled,
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
  const appUserId = useAppUserId();
  const currentUser = useCurrentUser();
  const isPlus = useHasPlusAccess();
  const examCountry = useAppShellStore((state) => state.examCountry);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const previousIdentitySignatureRef = useRef<string | null>(null);
  const aliasedSupabaseUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog || !isPostHogCaptureEnabled()) {
      previousIdentitySignatureRef.current = null;
      aliasedSupabaseUserIdRef.current = null;
      return;
    }

    const supabaseUserId =
      currentUser?.provider === "supabase" ? currentUser.id : null;
    const identitySignature = [
      appUserId,
      supabaseUserId ?? "",
      currentUser?.email ?? "",
      currentUser?.fullName ?? "",
      examCountry ?? "",
      preferredCategory,
      preferredLocale,
      String(isPlus),
    ].join("|");

    if (previousIdentitySignatureRef.current === identitySignature) {
      return;
    }

    posthog.identify(appUserId, {
      [ANALYTICS_PROPERTIES.appUserId]: appUserId,
      auth_mode: currentUser?.provider ?? "guest",
      category: preferredCategory,
      email: currentUser?.email ?? null,
      [ANALYTICS_PROPERTIES.examCountry]: examCountry,
      full_name: currentUser?.fullName ?? null,
      is_plus: isPlus,
      locale: preferredLocale,
      [ANALYTICS_PROPERTIES.supabaseUserId]: supabaseUserId,
    });

    if (
      supabaseUserId &&
      aliasedSupabaseUserIdRef.current !== supabaseUserId &&
      typeof posthog.alias === "function"
    ) {
      posthog.alias(supabaseUserId);
      aliasedSupabaseUserIdRef.current = supabaseUserId;
    }

    previousIdentitySignatureRef.current = identitySignature;
  }, [
    appUserId,
    currentUser,
    examCountry,
    isPlus,
    posthog,
    preferredCategory,
    preferredLocale,
  ]);

  return null;
}
