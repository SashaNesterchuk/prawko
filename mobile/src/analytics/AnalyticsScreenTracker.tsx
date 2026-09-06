import { useSegments } from "expo-router";
import { useEffect, useRef } from "react";

import { ANALYTICS_EVENTS } from "./catalog";
import {
  analyticsPathFromSegments,
  resolveScreenRoute,
} from "./screenRoutes";
import { useAnalytics } from "../providers/AnalyticsProvider";

export function AnalyticsScreenTracker() {
  const segments = useSegments();
  const { track } = useAnalytics();
  const previousPathRef = useRef<string | null>(null);
  const pathname = analyticsPathFromSegments(segments);

  useEffect(() => {
    if (!pathname || pathname === "/e2e/bootstrap") {
      return;
    }

    if (previousPathRef.current === pathname) {
      return;
    }

    previousPathRef.current = pathname;
    const route = resolveScreenRoute(pathname);

    track(ANALYTICS_EVENTS.screenViewed.key, {
      route_pattern: route.routePattern,
      screen_name: route.screenName,
    });
  }, [pathname, track]);

  return null;
}
