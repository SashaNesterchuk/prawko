import { Redirect } from "expo-router";
import { useTranslation } from "react-i18next";

import { AppScreen } from "../src/components/shell/AppScreen";
import { LoadingStateView } from "../src/components/shell/StateViews";
import {
  useHasHydrated,
  useNextOnboardingRoute,
  useAppShellStore,
} from "../src/state/app-shell";

export default function IndexScreen() {
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

  return <Redirect href="/(tabs)" />;
}
