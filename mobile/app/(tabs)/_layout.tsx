import { Redirect, Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { AppScreen } from "../../src/components/shell/AppScreen";
import { LoadingStateView } from "../../src/components/shell/StateViews";
import { useTheme } from "../../src/providers/ThemeProvider";
import {
  useCurrentUser,
  useHasHydrated,
  useNextOnboardingRoute,
  useAppShellStore,
} from "../../src/state/app-shell";

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const hasHydrated = useHasHydrated();
  const sessionResolved = useAppShellStore((state) => state.sessionResolved);
  const onboardingCompleted = useAppShellStore(
    (state) => state.onboardingCompleted
  );
  const currentUser = useCurrentUser();
  const nextOnboardingRoute = useNextOnboardingRoute();

  if (!hasHydrated || !sessionResolved) {
    return (
      <AppScreen scroll={false} title="Prawko">
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t("states.loadingSubtitle")}
        />
      </AppScreen>
    );
  }

  if (!onboardingCompleted) {
    return <Redirect href={nextOnboardingRoute} />;
  }

  if (!currentUser) {
    return <Redirect href="/(onboarding)/access" />;
  }

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
