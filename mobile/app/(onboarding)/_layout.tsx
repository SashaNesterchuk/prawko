import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="language" />
      <Stack.Screen name="category" />
      <Stack.Screen name="exam-schedule" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="minutes" />
      <Stack.Screen name="level" />
      <Stack.Screen name="school-code" />
      <Stack.Screen name="access" />
      <Stack.Screen name="preview" />
    </Stack>
  );
}
