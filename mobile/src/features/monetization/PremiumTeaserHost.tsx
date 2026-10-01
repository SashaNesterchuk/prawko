import * as Application from "expo-application";
import { router, usePathname, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";

import { isHomeScreenFromSegments } from "../../analytics/screenRoutes";
import { useHasPlusAccess } from "../../state/entitlements";
import { useAppShellStore, useHasHydrated } from "../../state/app-shell";
import {
  canShowMonetizationSurface,
  markMonetizationSurfaceShown,
  useMonetizationStore,
} from "./monetization-store";
import {
  isInterstitialShowing,
  subscribeInterstitialShowing,
} from "../ads/interstitial-controller";

/**
 * Routes automatic paywall requests. The premium bottom sheet is not shown:
 * Home already has the unlock card, and app-open / after-ad popups are off.
 */
export function PremiumTeaserHost() {
  const pathname = usePathname();
  const segments = useSegments();
  const isHomeScreen = isHomeScreenFromSegments(segments);
  const hasPlusAccess = useHasPlusAccess();
  const appShellHydrated = useHasHydrated();
  const onboardingCompleted = useAppShellStore(
    (state) => state.onboardingCompleted
  );
  const monetizationHydrated = useMonetizationStore(
    (state) => state.hasHydrated
  );
  const pendingRequest = useMonetizationStore(
    (state) => state.pendingRequest
  );
  const resolveRequest = useMonetizationStore(
    (state) => state.resolveRequest
  );
  const recordLaunch = useMonetizationStore((state) => state.recordLaunch);
  const setInstalledAt = useMonetizationStore(
    (state) => state.setInstalledAt
  );
  const didRecordLaunchRef = useRef(false);
  const [isAdShowing, setIsAdShowing] = useState(isInterstitialShowing);

  useEffect(() => subscribeInterstitialShowing(setIsAdShowing), []);

  useEffect(() => {
    if (
      !appShellHydrated ||
      !monetizationHydrated ||
      didRecordLaunchRef.current
    ) {
      return;
    }

    didRecordLaunchRef.current = true;
    void Application.getInstallationTimeAsync()
      .then(setInstalledAt)
      .catch(() => undefined)
      .finally(() => {
        recordLaunch();
      });
  }, [
    appShellHydrated,
    monetizationHydrated,
    recordLaunch,
    setInstalledAt,
  ]);

  useEffect(() => {
    if (
      !pendingRequest ||
      isAdShowing ||
      !appShellHydrated ||
      !monetizationHydrated ||
      !onboardingCompleted
    ) {
      return;
    }

    if (pendingRequest.surface !== "paywall") {
      resolveRequest(pendingRequest.id);
      return;
    }

    if (hasPlusAccess && pendingRequest.moment !== "manual_test") {
      resolveRequest(pendingRequest.id);
      return;
    }

    if (
      pathname.includes("/paywall") ||
      pathname.includes("/(onboarding)") ||
      pathname.includes("/exam/session")
    ) {
      return;
    }

    if (pendingRequest.moment === "app_open" && !isHomeScreen) {
      return;
    }

    const delayMs = pendingRequest.moment === "manual_test" ? 0 : 200;
    let cancelled = false;
    const timeout = setTimeout(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;

        if (
          pendingRequest.moment !== "manual_test" &&
          !canShowMonetizationSurface(
            pendingRequest.surface,
            Date.now(),
            pendingRequest.moment
          )
        ) {
          resolveRequest(pendingRequest.id);
          return;
        }

        markMonetizationSurfaceShown("paywall");
        resolveRequest(pendingRequest.id);
        router.push({
          pathname: "/paywall",
          params: {
            moment: pendingRequest.moment,
            presentation: "modal",
            source: "automatic",
          },
        });
      });

      if (cancelled) task.cancel?.();
    }, delayMs);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    appShellHydrated,
    hasPlusAccess,
    isAdShowing,
    isHomeScreen,
    monetizationHydrated,
    onboardingCompleted,
    pathname,
    pendingRequest,
    resolveRequest,
  ]);

  return null;
}
