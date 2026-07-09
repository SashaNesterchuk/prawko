import "react-native-gesture-handler";
import "react-native-reanimated";

import { Stack } from "expo-router";

import { AppProviders } from "../src/providers/AppProviders";

export default function RootLayout() {
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
