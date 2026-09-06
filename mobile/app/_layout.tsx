import "react-native-gesture-handler";
import "react-native-reanimated";

import { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Observe, ObserveRoot, useObserve } from "expo-observe";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { configureFonts } from "../src/portable-ui";
import { AnalyticsScreenTracker } from "../src/analytics/AnalyticsScreenTracker";
import { mobileEnv } from "../src/config/env";
import { getOrCreateAppUserId } from "../src/identity/app-user-id";
import { AppProviders } from "../src/providers/AppProviders";
import {
  useAppShellStore,
  useHasHydrated,
} from "../src/state/app-shell";
import "../src/testing/e2e/setup";

Observe.configure({
  dispatchingEnabled: !mobileEnv.enableE2ETestMode,
  integrations: { "expo-router": true },
});

const appFonts = {
  "Roboto-Regular": require("../assets/fonts/Roboto/Roboto-Regular.ttf"),
  "Roboto-Medium": require("../assets/fonts/Roboto/Roboto-Medium.ttf"),
  "Roboto-SemiBold": require("../assets/fonts/Roboto/Roboto-SemiBold.ttf"),
  "Roboto-Bold": require("../assets/fonts/Roboto/Roboto-Bold.ttf"),
  "RobotoMono-Regular": require(
    "../assets/fonts/Roboto_Mono/RobotoMono-Regular.ttf"
  ),
};

configureFonts({
  regular: "Roboto-Regular",
  medium: "Roboto-Medium",
  semiBold: "Roboto-SemiBold",
  bold: "Roboto-Bold",
  mono: "RobotoMono-Regular",
});

void SplashScreen.preventAutoHideAsync();

function ObserveAppReadyMarker() {
  const { markInteractive } = useObserve();
  const hasHydrated = useHasHydrated();
  const sessionResolved = useAppShellStore((state) => state.sessionResolved);

  useEffect(() => {
    if (!hasHydrated || !sessionResolved) {
      return;
    }

    markInteractive();
  }, [hasHydrated, markInteractive, sessionResolved]);

  return null;
}

function RootLayout() {
  const [loaded, error] = useFonts(appFonts);
  const [appUserId, setAppUserId] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  useEffect(() => {
    void getOrCreateAppUserId().then(setAppUserId);
  }, []);

  useEffect(() => {
    if (!appUserId) {
      return;
    }

    Observe.setGlobalAttributes({
      app_user_id: appUserId,
      revenuecat_app_user_id: appUserId,
    });
  }, [appUserId]);

  useEffect(() => {
    if (loaded && appUserId) {
      void SplashScreen.hideAsync();
    }
  }, [appUserId, loaded]);

  if (!loaded || !appUserId) {
    return null;
  }

  return (
    <AppProviders appUserId={appUserId}>
      <ObserveAppReadyMarker />
      <AnalyticsScreenTracker />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen
          name="e2e/bootstrap"
          options={{
            animation: "none",
          }}
        />
        {/* Progress-stats screens re-derive the whole question bank whenever
            progress changes, so they stay frozen while the trainer is on top. */}
        <Stack.Screen name="(tabs)" options={{ freezeOnBlur: true }} />
        <Stack.Screen
          name="exam"
          options={{
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="question"
          options={{
            animation: "slide_from_right",
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="topics/index"
          options={{
            animation: "slide_from_right",
            freezeOnBlur: true,
          }}
        />
        <Stack.Screen
          name="mistakes/index"
          options={{
            animation: "slide_from_right",
            freezeOnBlur: true,
          }}
        />
        <Stack.Screen
          name="practice/index"
          options={{
            animation: "slide_from_right",
            freezeOnBlur: true,
          }}
        />
        <Stack.Screen
          name="signs/index"
          options={{
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="signs/search"
          options={{
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="signs/category/[categoryId]"
          options={{
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="signs/category/[categoryId]/test"
          options={{
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="signs/[signId]/index"
          options={{
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="signs/[signId]/practice"
          options={{
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="statistics/index"
          options={{
            animation: "slide_from_right",
            freezeOnBlur: true,
          }}
        />
        <Stack.Screen
          name="trainer-modes"
          options={{
            animation: "slide_from_right",
            freezeOnBlur: true,
          }}
        />
        <Stack.Screen
          name="topic/[topicId]"
          options={{
            animation: "slide_from_right",
            freezeOnBlur: true,
          }}
        />
        <Stack.Screen
          name="paywall"
          options={{
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="offline-mode"
          options={{
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="modals/ai-chat"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="modals/access-center"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="modals/plan-adjust"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
    </AppProviders>
  );
}

export default ObserveRoot.wrap(RootLayout);
