import { useCallback, useMemo } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { usePostHog } from "posthog-react-native";

import {
  ANALYTICS_PROPERTIES,
  sanitizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsEventPayloads,
  type AnalyticsProperties,
} from "../analytics/catalog";
import { isPostHogCaptureEnabled } from "../analytics/posthog-build-gate";
import { useAppUserId } from "../identity/AppIdentityProvider";
import { useAppShellStore, useCurrentUser } from "../state/app-shell";
import { useHasPlusAccess } from "../state/entitlements";

export type AnalyticsTrackPayload = AnalyticsProperties;
export type AnalyticsTrack = <EventName extends AnalyticsEventName>(
  event: EventName,
  payload?: AnalyticsEventPayloads[EventName]
) => void;

export function useAnalytics() {
  const posthog = usePostHog();
  const appUserId = useAppUserId();
  const currentUser = useCurrentUser();
  const examCountry = useAppShellStore((state) => state.examCountry);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const isPlus = useHasPlusAccess();
  const isConfigured = isPostHogCaptureEnabled();

  const baseProperties = useMemo(
    () => ({
      app_version: Constants.expoConfig?.version ?? "unknown",
      [ANALYTICS_PROPERTIES.appUserId]: appUserId,
      auth_mode: currentUser?.provider ?? "guest",
      category: preferredCategory,
      [ANALYTICS_PROPERTIES.examCountry]: examCountry,
      is_plus: isPlus,
      locale: preferredLocale,
      platform: Platform.OS,
      [ANALYTICS_PROPERTIES.supabaseUserId]:
        currentUser?.provider === "supabase" ? currentUser.id : null,
    }),
    [
      appUserId,
      currentUser?.id,
      currentUser?.provider,
      examCountry,
      isPlus,
      preferredCategory,
      preferredLocale,
    ]
  );

  const capture: AnalyticsTrack = useCallback(
    <EventName extends AnalyticsEventName>(
      event: EventName,
      payload?: AnalyticsEventPayloads[EventName]
    ) => {
      if (!posthog || !isConfigured) {
        return;
      }

      posthog.capture(
        event,
        sanitizeAnalyticsProperties({ ...baseProperties, ...payload })
      );
    },
    [baseProperties, isConfigured, posthog]
  );

  const screen = useCallback(
    (name: string, payload?: AnalyticsTrackPayload) => {
      if (!posthog || !isConfigured) {
        return;
      }

      void posthog.screen(
        name,
        sanitizeAnalyticsProperties({ ...baseProperties, ...payload })
      );
    },
    [baseProperties, isConfigured, posthog]
  );

  const identify = useCallback(
    (distinctId: string, payload?: AnalyticsTrackPayload) => {
      if (!posthog || !isConfigured) {
        return;
      }

      posthog.identify(distinctId, sanitizeAnalyticsProperties(payload));
    },
    [isConfigured, posthog]
  );

  const reset = useCallback(() => {
    // Install identity is durable across auth. Never mint a new anonymous distinct_id.
  }, []);

  return {
    capture,
    identify,
    isConfigured,
    reset,
    screen,
    track: capture,
  };
}
