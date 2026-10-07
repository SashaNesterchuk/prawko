import { useCallback, useMemo } from "react";
import { usePostHog } from "posthog-react-native";

import {
  sanitizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsPayloadArguments,
  type AnalyticsProperties,
} from "../analytics/catalog";
import { recordLocalAnalytics } from "../analytics/local-analytics-log";
import { isPostHogCaptureEnabled } from "../analytics/posthog-build-gate";
import { nextAnalyticsEventContext } from "../analytics/runtime-context";
import { analyticsActivity } from "../analytics/activity";
import { getAnalyticsBaseProperties } from "../analytics/base-properties";
import { isAnalyticsInteraction } from "../analytics/interactions";
import { getQuestionContentProperties } from "../analytics/content-revisions";
import { getQuestionBankById } from "../features/questions/question-bank";
import type { SupportedLocale } from "@prawko/config";
import { validateAnalyticsPayload } from "../analytics/payload-contract";
import { getAnalyticsDiagnosticsProperties, recordAnalyticsFailure } from "../analytics/capture-diagnostics";
import { onboardingObservation, onboardingObservationProperties } from "../analytics/onboarding-observation";
import { observeFeatureAccess } from "../analytics/access-observation";
import { observeCachedExamRules } from "../analytics/exam-rules-observation";
import { useAppUserId } from "../identity/AppIdentityProvider";
import { useAppShellStore, useCurrentUser } from "../state/app-shell";
import { useHasPlusAccess } from "../state/entitlements";

export type AnalyticsTrackPayload = AnalyticsProperties;
export type AnalyticsTrack = <EventName extends AnalyticsEventName>(
  event: EventName,
  ...args: AnalyticsPayloadArguments<NoInfer<EventName>>
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
  // Keep the existing subscription/callback lifecycle while capture reads fresh state.
  const baseProperties = useMemo(() => ({
    app_user_id: appUserId,
    auth_mode: currentUser?.provider ?? "guest",
    supabase_user_id: currentUser?.provider === "supabase" ? currentUser.id : null,
    exam_country: examCountry,
    category: preferredCategory,
    locale: preferredLocale,
    is_plus: isPlus,
  }), [appUserId, currentUser?.id, currentUser?.provider, examCountry, preferredCategory, preferredLocale, isPlus]);

  const capture: AnalyticsTrack = useCallback(
    <EventName extends AnalyticsEventName>(
      event: EventName,
      ...args: AnalyticsPayloadArguments<NoInfer<EventName>>
    ) => {
      const payload = args[0];
      try {
        if (isAnalyticsInteraction(event, payload)) analyticsActivity.recordInteraction();
        const question = typeof payload?.question_id === "string"
          ? getQuestionBankById()[payload.question_id] : null;
        const contentProperties = question ? getQuestionContentProperties(question,
          (payload?.content_requested_locale ?? payload?.locale ??
            useAppShellStore.getState().preferredLocale) as SupportedLocale) : {};
        const activityContext = analyticsActivity.getContext();
        const onboarding = activityContext.flow_context === "onboarding"
          ? onboardingObservation.peek(appUserId) : null;
        const eventProperties = sanitizeAnalyticsProperties({
          ...baseProperties,
          ...getAnalyticsBaseProperties(appUserId),
          ...activityContext,
          ...(onboarding ? onboardingObservationProperties(onboarding) : {}),
          ...contentProperties,
          ...observeCachedExamRules(payload ?? {}),
          ...payload,
          ...nextAnalyticsEventContext(),
        }) ?? {};
        const observedProperties = { ...eventProperties, ...observeFeatureAccess(event, eventProperties) };
        const validation = validateAnalyticsPayload(event, observedProperties);
        if (!validation.analytics_payload_valid) recordAnalyticsFailure("payload");
        const properties = sanitizeAnalyticsProperties({
          ...observedProperties,
          ...validation, ...getAnalyticsDiagnosticsProperties(),
        });
        recordLocalAnalytics({ kind: "capture", event, properties });
        if (posthog && isConfigured) posthog.capture(event, properties);
      } catch {
        recordAnalyticsFailure("capture");
        // Observation must never interrupt the product operation.
      }
    },
    [appUserId, baseProperties, isConfigured, posthog]
  );

  const screen = useCallback(
    (name: string, payload?: AnalyticsTrackPayload) => {
      try {
        const properties = sanitizeAnalyticsProperties({
          ...baseProperties,
          ...getAnalyticsBaseProperties(appUserId),
          ...analyticsActivity.getContext(),
          ...payload,
          ...nextAnalyticsEventContext(),
        });
        recordLocalAnalytics({ kind: "screen", event: name, properties });
        if (posthog && isConfigured) void posthog.screen(name, properties).catch(() => recordAnalyticsFailure("screen"));
      } catch {
        recordAnalyticsFailure("screen");
        // SDK/storage failures are not screen failures.
      }
    },
    [appUserId, baseProperties, isConfigured, posthog]
  );

  const identify = useCallback(
    (distinctId: string, payload?: AnalyticsTrackPayload) => {
      try {
        const properties = sanitizeAnalyticsProperties(payload);
        recordLocalAnalytics({ kind: "identify", event: distinctId, properties });
        if (posthog && isConfigured) posthog.identify(distinctId, properties);
      } catch {
        recordAnalyticsFailure("identify");
        // Identity telemetry cannot affect authentication.
      }
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
