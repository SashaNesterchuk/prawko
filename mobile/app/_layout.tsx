import "react-native-gesture-handler";
import "react-native-reanimated";

import { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

import { configureFonts } from "../src/portable-ui";
import { AppProviders } from "../src/providers/AppProviders";

const appFonts = {
  CustomSet: require("../assets/fonts/CustomSet-v2.0/fonts/CustomSet.ttf"),
  "Roboto-Bold": require("../assets/fonts/Roboto/Roboto-Bold.ttf"),
  "Roboto-Medium": require("../assets/fonts/Roboto/Roboto-Medium.ttf"),
  "Roboto-Regular": require("../assets/fonts/Roboto/Roboto-Regular.ttf"),
  "Roboto-Light": require("../assets/fonts/Roboto/Roboto-Light.ttf"),
  "Roboto-BoldItalic": require("../assets/fonts/Roboto/Roboto-BoldItalic.ttf"),
  "SourceSans3-SemiBoldItalic": require(
    "../assets/fonts/SourceSans/SourceSans3-SemiBoldItalic.ttf"
  ),
  "SourceSans3-BoldItalic": require(
    "../assets/fonts/SourceSans/SourceSans3-BoldItalic.ttf"
  ),
  "RobotoSerif-MediumItalic28": require(
    "../assets/fonts/RobotoSerif/RobotoSerif_28pt-MediumItalic.ttf"
  ),
};

configureFonts({
  regular: "Roboto-Regular",
  medium: "Roboto-Medium",
  bold: "Roboto-Bold",
  light: "Roboto-Light",
  italic: "SourceSans3-SemiBoldItalic",
  boldItalic: "Roboto-BoldItalic",
  sansBoldItalic: "SourceSans3-BoldItalic",
  robotoSerifMediumItalic28: "RobotoSerif-MediumItalic28",
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
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="exam" />
        <Stack.Screen
          name="question"
          options={{
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="topics/index"
          options={{
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="mistakes/index"
          options={{
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="practice/index"
          options={{
            animation: "slide_from_right",
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
          }}
        />
        <Stack.Screen
          name="topic/[topicId]"
          options={{
            animation: "slide_from_right",
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
