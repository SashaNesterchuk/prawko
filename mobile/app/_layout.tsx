import "react-native-gesture-handler";
import "react-native-reanimated";

import { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { configureFonts } from "../src/portable-ui";
import { AppProviders } from "../src/providers/AppProviders";

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

export default function RootLayout() {
  const [loaded, error] = useFonts(appFonts);

  useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      void SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
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
          name="modals/media-viewer"
          options={{
            presentation: "fullScreenModal",
            animation: "fade",
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
