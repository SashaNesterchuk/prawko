import { useGlobalSearchParams, useSegments } from "expo-router";
import { useLayoutEffect, useRef } from "react";
import { AppState } from "react-native";

import { ANALYTICS_EVENTS, ANALYTICS_SCREENS } from "./catalog";
import {
  analyticsPathFromSegments,
  resolveScreenRoute,
} from "./screenRoutes";
import { useAnalytics } from "../providers/AnalyticsProvider";
import { analyticsActivity } from "./activity";
import { readLearningIntentId } from "./operations";
import { consumeOnboardingEntryContext } from "./onboarding-context";
import { useAppShellStore } from "../state/app-shell";
import { useAppUserId } from "../identity/AppIdentityProvider";
import {
  bindOnboardingObservationIdentity,
  onboardingObservation,
  onboardingObservationProperties,
} from "./onboarding-observation";

export function AnalyticsScreenTracker() {
  const segments = useSegments();
  const params = useGlobalSearchParams();
  const onboardingCompleted = useAppShellStore((state) => state.onboardingCompleted);
  const hasHydrated = useAppShellStore((state) => state.hasHydrated);
  const appUserId = useAppUserId();
  const { track } = useAnalytics();
  const previousPathRef = useRef<string | null>(null);
  const pathname = analyticsPathFromSegments(segments);
  const entity = ["sessionId", "session", "signId", "categoryId", "topicId"]
    .map((key) => params[key]).find((value) => typeof value === "string") ?? null;
  const entityId = typeof entity === "string" ? entity : null;
  const learningIntentId = readLearningIntentId(params.analyticsIntentId);
  const flowRef = useRef<string | null>(null);
  const viewedFlowRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    bindOnboardingObservationIdentity(appUserId);
    if (!hasHydrated) return;
    if (!pathname || pathname === "/e2e/bootstrap") {
      return;
    }

    const route = resolveScreenRoute(pathname);
    // The root route only redirects or shows a loading gate. Counting it as a
    // screen makes every launch look like a visit to app_entry.
    if (route.screenName === ANALYTICS_SCREENS.appEntry) {
      void onboardingObservation.resolve(appUserId).catch(() => undefined);
      return;
    }

    const signature = `${pathname}:${entityId}:${onboardingCompleted}`;
    const flowContext = route.screenName.startsWith("onboarding_")
      ? onboardingCompleted ? "settings" : "onboarding" : "product";
    let current = true;
    const setScreen = (attemptId: string | null) => analyticsActivity.setScreen({
      route_pattern: route.routePattern, screen_name: route.screenName,
      route_entity_id: entityId, flow_context: flowContext,
      onboarding_attempt_id: attemptId, learning_intent_id: learningIntentId,
    });
    if (flowContext === "onboarding") {
      const entry = consumeOnboardingEntryContext();
      void onboardingObservation.resolve(appUserId, entry).then((observation) => {
        if (!current || !observation) return;
        flowRef.current = observation.attemptId;
        setScreen(observation.attemptId);
        if (viewedFlowRef.current === observation.attemptId) return;
        viewedFlowRef.current = observation.attemptId;
        track(ANALYTICS_EVENTS.onboardingFlowViewed.key, onboardingObservationProperties(observation));
      }).catch(() => undefined);
    }
    if (flowContext !== "onboarding") flowRef.current = null;
    setScreen(flowRef.current);

    const observeHome = () => {
      if (route.screenName !== ANALYTICS_SCREENS.home || !onboardingCompleted ||
        AppState.currentState !== "active") return;
      const observedAt = new Date().toISOString();
      void onboardingObservation.home(appUserId, observedAt).then((observation) => {
        if (!observation) return;
        track(ANALYTICS_EVENTS.onboardingHomeArrived.key, {
          ...onboardingObservationProperties(observation),
          screen_name: route.screenName, route_pattern: route.routePattern,
          home_arrival_basis: "foreground_route_observed",
        });
      }).catch(() => undefined);
    };
    observeHome();
    const visibility = AppState.addEventListener("change", (state) => {
      if (state === "active") observeHome();
    });
    if (previousPathRef.current === signature) {
      return () => { current = false; visibility.remove(); };
    }

    previousPathRef.current = signature;

    track(ANALYTICS_EVENTS.screenViewed.key, {
      screen_observation_scope: "route",
      route_pattern: route.routePattern,
      screen_name: route.screenName,
      route_entity_id: entityId,
      flow_context: flowContext,
      onboarding_attempt_id: flowRef.current,
      onboarding_observation_state: flowContext === "onboarding"
        ? flowRef.current ? "resolved" : "pending" : "not_applicable",
      learning_intent_id: learningIntentId,
    });
    return () => { current = false; visibility.remove(); };
  }, [appUserId, entityId, hasHydrated, learningIntentId, onboardingCompleted, pathname, track]);

  return null;
}
