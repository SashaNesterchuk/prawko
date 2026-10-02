import { useGlobalSearchParams, useSegments } from "expo-router";
import { useLayoutEffect, useRef } from "react";

import { ANALYTICS_EVENTS, ANALYTICS_SCREENS } from "./catalog";
import {
  analyticsPathFromSegments,
  resolveScreenRoute,
} from "./screenRoutes";
import { useAnalytics } from "../providers/AnalyticsProvider";
import { analyticsActivity } from "./activity";
import { createAnalyticsId } from "./runtime-context";
import { readLearningIntentId } from "./operations";
import { consumeOnboardingEntryContext } from "./onboarding-context";
import { useAppShellStore } from "../state/app-shell";

export function AnalyticsScreenTracker() {
  const segments = useSegments();
  const params = useGlobalSearchParams();
  const onboardingCompleted = useAppShellStore((state) => state.onboardingCompleted);
  const { track } = useAnalytics();
  const previousPathRef = useRef<string | null>(null);
  const pathname = analyticsPathFromSegments(segments);
  const entity = ["sessionId", "session", "signId", "categoryId", "topicId"]
    .map((key) => params[key]).find((value) => typeof value === "string") ?? null;
  const entityId = typeof entity === "string" ? entity : null;
  const learningIntentId = readLearningIntentId(params.analyticsIntentId);
  const flowRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!pathname || pathname === "/e2e/bootstrap") {
      return;
    }

    const route = resolveScreenRoute(pathname);
    // The root route only redirects or shows a loading gate. Counting it as a
    // screen makes every launch look like a visit to app_entry.
    if (route.screenName === ANALYTICS_SCREENS.appEntry) {
      return;
    }

    const signature = `${pathname}:${entityId}:${onboardingCompleted}`;
    const flowContext = route.screenName.startsWith("onboarding_")
      ? onboardingCompleted ? "settings" : "onboarding" : "product";
    if (flowContext === "onboarding" && !flowRef.current) {
      flowRef.current = createAnalyticsId("onboarding");
      const entry = consumeOnboardingEntryContext();
      analyticsActivity.setScreen({
        route_pattern: route.routePattern, screen_name: route.screenName,
        route_entity_id: entityId, flow_context: flowContext,
        onboarding_attempt_id: flowRef.current, learning_intent_id: learningIntentId,
      });
      track(ANALYTICS_EVENTS.onboardingFlowViewed.key, {
        ...entry, onboarding_attempt_id: flowRef.current,
        flow_version: "category_schedule_v1", flow_context: flowContext,
      });
    }
    if (onboardingCompleted) flowRef.current = null;
    analyticsActivity.setScreen({
      route_pattern: route.routePattern,
      screen_name: route.screenName,
      route_entity_id: entityId,
      flow_context: flowContext,
      onboarding_attempt_id: flowRef.current,
      learning_intent_id: learningIntentId,
    });
    if (previousPathRef.current === signature) {
      return;
    }

    previousPathRef.current = signature;

    track(ANALYTICS_EVENTS.screenViewed.key, {
      route_pattern: route.routePattern,
      screen_name: route.screenName,
      route_entity_id: entityId,
      flow_context: flowContext,
      onboarding_attempt_id: flowRef.current,
      learning_intent_id: learningIntentId,
    });
  }, [entityId, learningIntentId, onboardingCompleted, pathname, track]);

  return null;
}
