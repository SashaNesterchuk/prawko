import { Redirect } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { AppScreen } from "../src/components/shell/AppScreen";
import { LoadingStateView } from "../src/components/shell/StateViews";
import { finalizeLocalOnboarding } from "../src/features/onboarding/finalize-local-onboarding";
import {
  canFinalizeOnboarding,
  useHasHydrated,
  useNextOnboardingRoute,
  useAppShellStore,
} from "../src/state/app-shell";

export default function IndexScreen() {
  const { t } = useTranslation();
  const hasHydrated = useHasHydrated();
  const sessionResolved = useAppShellStore((state) => state.sessionResolved);
  const examCountry = useAppShellStore((state) => state.examCountry);
  const onboardingCompleted = useAppShellStore(
    (state) => state.onboardingCompleted
  );
  const categoryDone = useAppShellStore(
    (state) => state.onboardingProgress.categoryDone
  );
  const scheduleDone = useAppShellStore(
    (state) => state.onboardingProgress.scheduleDone
  );
  const daysUntilExam = useAppShellStore(
    (state) => state.studyPlanSetup.daysUntilExam
  );
  const nextOnboardingRoute = useNextOnboardingRoute();
  const shouldFinalizeOnboarding =
    hasHydrated &&
    sessionResolved &&
    Boolean(examCountry) &&
    !onboardingCompleted &&
    canFinalizeOnboarding({
      onboardingProgress: { categoryDone, scheduleDone },
      studyPlanSetup: { daysUntilExam },
    });

  useEffect(() => {
    if (!shouldFinalizeOnboarding) {
      return;
    }

    finalizeLocalOnboarding();
  }, [shouldFinalizeOnboarding]);

  if (!hasHydrated || !sessionResolved || !examCountry) {
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
    if (shouldFinalizeOnboarding) {
      return (
        <AppScreen scroll={false} title="Prawko">
          <LoadingStateView
            title={t("states.loadingTitle")}
            description={t("states.loadingSubtitle")}
          />
        </AppScreen>
      );
    }

    return <Redirect href={nextOnboardingRoute} />;
  }

  return <Redirect href="/(tabs)" />;
}
