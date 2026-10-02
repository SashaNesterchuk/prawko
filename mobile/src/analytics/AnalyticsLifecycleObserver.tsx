import { useLayoutEffect, useRef } from "react";
import { AppState, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { analyticsActivity, ACTIVITY_CHECKPOINT_MS } from "./activity";
import { ANALYTICS_EVENTS } from "./catalog";
import { resolveScreenRoute } from "./screenRoutes";
import { useAnalytics } from "../hooks/useAnalytics";

const SEEN_RESPONSES_KEY = "prawko.analytics.notification-responses.v1";

function deepLinkProperties(url: string) {
  let pathname = "";
  try {
    const parsed = new URL(url);
    pathname = parsed.pathname;
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      pathname = `/${parsed.hostname}${pathname}`;
    }
  } catch { /* A malformed URL is unknown, not raw analytics content. */ }
  const route = resolveScreenRoute(pathname);
  return {
    entry_reason: "deep_link",
    entry_route_pattern: route.routePattern,
    entry_screen_name: route.screenName,
  };
}

export function AnalyticsLifecycleObserver() {
  const { track } = useAnalytics();
  const trackRef = useRef(track);
  trackRef.current = track;

  useLayoutEffect(() => {
    const emit: typeof track = (event, payload) => trackRef.current(event, payload);
    analyticsActivity.setEmitter(emit);
    analyticsActivity.observeVisibility(AppState.currentState);
    const visibility = AppState.addEventListener("change", (state) => {
      analyticsActivity.observeVisibility(state);
      if (state === "background") {
        analyticsActivity.setEntry({ entry_reason: "direct", attribution_confidence: "no_external_entry_observed" });
      }
    });
    const interval = setInterval(() => analyticsActivity.checkpoint(), ACTIVITY_CHECKPOINT_MS);
    let disposed = false;
    let resolvedEntry = false;
    const linking = Linking.addEventListener("url", ({ url }) => {
      const properties = deepLinkProperties(url);
      resolvedEntry = true;
      analyticsActivity.setEntry(properties);
      emit(ANALYTICS_EVENTS.appEntryResolved.key, properties);
    });
    void Linking.getInitialURL().then((url) => {
      if (disposed || resolvedEntry) return;
      const properties = url ? deepLinkProperties(url) : { entry_reason: "direct" };
      analyticsActivity.setEntry(properties);
      emit(ANALYTICS_EVENTS.appEntryResolved.key, properties);
    }).catch(() => {
      if (!disposed) emit(ANALYTICS_EVENTS.appEntryResolved.key, { entry_reason: "unknown" });
    });

    // Serialize cached and live responses so a cold-start response is counted once.
    let responseQueue: Promise<void> = Promise.resolve();
    const seen = new Set<string>();
    const loaded = AsyncStorage.getItem(SEEN_RESPONSES_KEY).then((value) => {
      try {
        const ids: unknown = value ? JSON.parse(value) : [];
        if (Array.isArray(ids)) for (const id of ids) if (typeof id === "string") seen.add(id);
      } catch { /* Bad analytics state never affects reminder handling. */ }
    }).catch(() => undefined);
    function recordResponse(response: Notifications.NotificationResponse, cached: boolean) {
      responseQueue = responseQueue.then(async () => {
        await loaded;
        if (disposed) return;
        const notification = response.notification;
        const key = `${notification.request.identifier}:${notification.date}:${response.actionIdentifier}`;
        const data = notification.request.content.data;
        const properties = {
          notification_response_id: key,
          notification_id: notification.request.identifier,
          notification_action: response.actionIdentifier,
          reminder_kind: data?.analytics_reminder_kind === "study_daily" ? "study_daily" : "unknown",
          cached_response: cached,
          entry_attributed: !cached,
          attribution_confidence: cached ? "cached_os_response" : "live_os_response",
        };
        // The last OS response has no tap timestamp and may belong to an old launch.
        if (!cached) {
          resolvedEntry = true;
          analyticsActivity.setEntry({ entry_reason: "notification", ...properties });
          emit(ANALYTICS_EVENTS.appEntryResolved.key, { entry_reason: "notification", ...properties });
        }
        if (seen.has(key)) return;
        seen.add(key);
        emit(ANALYTICS_EVENTS.notificationOpened.key, properties);
        await AsyncStorage.setItem(SEEN_RESPONSES_KEY, JSON.stringify([...seen].slice(-50))).catch(() => undefined);
      }).catch(() => undefined);
    }
    let notifications: ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null = null;
    try {
      notifications = Notifications.addNotificationResponseReceivedListener((response) => {
        recordResponse(response, false);
      });
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) recordResponse(response, true);
      }).catch(() => undefined);
    } catch { /* Notification telemetry is optional on unsupported runtimes. */ }

    return () => {
      disposed = true;
      clearInterval(interval);
      visibility.remove();
      linking.remove();
      notifications?.remove();
      analyticsActivity.checkpoint("observer_unmount");
      analyticsActivity.setEmitter(() => undefined);
    };
  }, []);
  return null;
}
