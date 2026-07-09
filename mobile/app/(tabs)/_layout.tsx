import { Redirect, Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { AppScreen } from "../../src/components/shell/AppScreen";
import { FloatingTabBar } from "../../src/components/shell/FloatingTabBar";
import { LoadingStateView } from "../../src/components/shell/StateViews";
import { greenWave } from "../../src/theme/green-wave";
import {
  useHasHydrated,
  useNextOnboardingRoute,
  useAppShellStore,
} from "../../src/state/app-shell";

export default function TabsLayout() {
  const { t } = useTranslation();
  const hasHydrated = useHasHydrated();
  const sessionResolved = useAppShellStore((state) => state.sessionResolved);
  const onboardingCompleted = useAppShellStore(
    (state) => state.onboardingCompleted
  );
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

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => null,
        sceneStyle: {
          backgroundColor: greenWave.color.paper,
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
        name="signs"
        options={{ title: t("nav.signs"), tabBarLabel: t("nav.signs") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t("nav.profile"), tabBarLabel: t("nav.profile") }}
      />
    </Tabs>
  );
}
