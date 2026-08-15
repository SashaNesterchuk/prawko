import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";

import { ANALYTICS_EVENTS } from "./catalog";
import { resolveScreenRoute } from "./screenRoutes";
import { useAnalytics } from "../providers/AnalyticsProvider";

export function AnalyticsScreenTracker() {
  const pathname = usePathname();
  const { track } = useAnalytics();
  const previousPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === "/e2e/bootstrap") {
      return;
    }

    if (previousPathnameRef.current === pathname) {
      return;
    }

    previousPathnameRef.current = pathname;
    const route = resolveScreenRoute(pathname);

    track(ANALYTICS_EVENTS.screenViewed.key, {
      route_pattern: route.routePattern,
      screen_name: route.screenName,
    });
  }, [pathname, track]);

  return null;
}
