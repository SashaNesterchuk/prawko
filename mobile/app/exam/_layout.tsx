import { Stack } from "expo-router";

export default function ExamLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="session"
        options={{
          animation: "slide_from_right",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="result"
        options={{
          animation: "fade_from_bottom",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="answers"
        options={{
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}
