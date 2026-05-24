import { Redirect, Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppScreen } from "../../src/components/shell/AppScreen";
import { LoadingStateView } from "../../src/components/shell/StateViews";
import { useTheme } from "../../src/providers/ThemeProvider";
import {
  useCurrentUser,
  useHasHydrated,
  useNextOnboardingRoute,
  useAppShellStore,
} from "../../src/state/app-shell";

const TAB_BAR_CONTENT_HEIGHT = 56;

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { bottom: bottomInset } = useSafeAreaInsets();
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
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset > 0 ? bottomInset : 10,
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
