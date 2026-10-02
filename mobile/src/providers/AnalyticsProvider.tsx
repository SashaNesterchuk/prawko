import { PropsWithChildren, useEffect, useRef } from "react";
import { PostHogProvider, usePostHog } from "posthog-react-native";

import { ANALYTICS_EVENTS, ANALYTICS_PROPERTIES, sanitizeSdkAnalyticsValue } from "../analytics/catalog";
import { AnalyticsLifecycleObserver } from "../analytics/AnalyticsLifecycleObserver";
import { getAnalyticsBaseProperties } from "../analytics/base-properties";
import { useAnalytics } from "../hooks/useAnalytics";
import { isPostHogCaptureEnabled } from "../analytics/posthog-build-gate";
import { mobileEnv } from "../config/env";
import { useAppUserId } from "../identity/AppIdentityProvider";
import { useAppShellStore, useCurrentUser } from "../state/app-shell";
import { useEntitlementStore, useHasPlusAccess } from "../state/entitlements";

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
        before_send: (event) => {
          if (!event) return null;
          try {
            return {
              ...event,
              properties: sanitizeSdkAnalyticsValue(event.properties) as typeof event.properties,
              $set: sanitizeSdkAnalyticsValue(event.$set) as typeof event.$set,
              $set_once: sanitizeSdkAnalyticsValue(event.$set_once) as typeof event.$set_once,
            };
          } catch { return null; }
        },
      }}
    >
      <PostHogIdentitySync />
      <AnalyticsLifecycleObserver />
      <AccessAnalyticsObserver />
      {children}
    </PostHogProvider>
  );
}

function PostHogIdentitySync() {
  const posthog = usePostHog();
  const { identify } = useAnalytics();
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
      examCountry ?? "",
      preferredCategory,
      preferredLocale,
      String(isPlus),
    ].join("|");

    if (previousIdentitySignatureRef.current === identitySignature) {
      return;
    }

    identify(appUserId, {
      [ANALYTICS_PROPERTIES.appUserId]: appUserId,
      auth_mode: currentUser?.provider ?? "guest",
      category: preferredCategory,
      [ANALYTICS_PROPERTIES.examCountry]: examCountry,
      is_plus: isPlus,
      locale: preferredLocale,
      [ANALYTICS_PROPERTIES.supabaseUserId]: supabaseUserId,
    });
    // Lifecycle events bypass useAnalytics; register only safe context.
    try {
      void posthog.register(getAnalyticsBaseProperties(appUserId)).catch(() => undefined);
    } catch { /* Optional SDK context cannot affect identity synchronization. */ }

    if (
      supabaseUserId &&
      aliasedSupabaseUserIdRef.current !== supabaseUserId &&
      typeof posthog.alias === "function"
    ) {
      try {
        posthog.alias(supabaseUserId);
        aliasedSupabaseUserIdRef.current = supabaseUserId;
      } catch { /* Analytics identity must not affect auth. */ }
    }

    previousIdentitySignatureRef.current = identitySignature;
  }, [
    appUserId,
    currentUser,
    examCountry,
    isPlus,
    identify,
    posthog,
    preferredCategory,
    preferredLocale,
  ]);

  return null;
}

function AccessAnalyticsObserver() {
  const { track } = useAnalytics();
  const isPlus = useHasPlusAccess();
  const purchase = useEntitlementStore((state) =>
    state.revenueCatFeatureEntitlements.premium_access || state.revenueCatFeatureEntitlements.ai_question_chat);
  const school = useEntitlementStore((state) => Boolean(state.schoolAccess) &&
    (state.featureEntitlements.premium_access || state.featureEntitlements.ai_question_chat));
  const previous = useRef<{ plus: boolean; source: string } | null>(null);
  useEffect(() => {
    const source = !isPlus ? "none" : purchase ? "purchase" : school ? "school" : "other";
    const before = previous.current;
    if (before?.plus === isPlus && before.source === source) return;
    previous.current = { plus: isPlus, source };
    track(ANALYTICS_EVENTS.accessStateChanged.key, {
      observation_reason: before ? "state_change" : "initial_snapshot",
      previous_is_plus: before?.plus ?? null,
      previous_access_source: before?.source ?? null,
      is_plus: isPlus,
      access_source: source,
    });
  }, [isPlus, purchase, school, track]);
  return null;
}
