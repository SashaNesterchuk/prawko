import { STUDY_PLAN_LIMITS, type PlanLevel } from "@prawko/config";

import { generateLocalStudyPlan } from "../study-plan/generate-local-study-plan";
import { useAppShellStore } from "../../state/app-shell";

const DEFAULT_MINUTES_PER_DAY = 20;

type AppShellStore = ReturnType<typeof useAppShellStore.getState>;

/**
 * Mirrors the final onboarding step: fill any missing plan inputs, generate the
 * first local study plan, and mark onboarding as complete.
 */
export function finalizeLocalOnboarding(
  store: AppShellStore = useAppShellStore.getState(),
) {
  const setup = store.studyPlanSetup;
  const level: PlanLevel = setup.level ?? "first_time";
  const minutesPerDay = setup.minutesPerDay ?? DEFAULT_MINUTES_PER_DAY;
  const daysUntilExam =
    setup.daysUntilExam ?? STUDY_PLAN_LIMITS.recommendedDays;

  if (setup.level == null) {
    store.setLevel(level);
  }

  if (setup.minutesPerDay == null) {
    store.setMinutesPerDay(minutesPerDay);
  }

  const plan = generateLocalStudyPlan({
    category: store.preferredCategory,
    locale: store.preferredLocale,
    daysUntilExam,
    minutesPerDay,
    level,
    schoolCode: setup.schoolCode || undefined,
  });

  store.saveCurrentStudyPlan(plan);
  store.completeOnboarding();
}
