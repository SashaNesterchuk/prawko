import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../src/providers/ThemeProvider";

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderSoft,
          height: 68,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("nav.home"), tabBarLabel: t("nav.home") }}
      />
      <Tabs.Screen
        name="learn"
        options={{ title: t("nav.learn"), tabBarLabel: t("nav.learn") }}
      />
      <Tabs.Screen
        name="practice"
        options={{ title: t("nav.practice"), tabBarLabel: t("nav.practice") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t("nav.profile"), tabBarLabel: t("nav.profile") }}
      />
    </Tabs>
  );
}
