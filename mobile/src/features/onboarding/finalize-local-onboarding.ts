import { STUDY_PLAN_LIMITS, type PlanLevel } from "@prawko/config";

import { ANALYTICS_EVENTS } from "../../analytics/catalog";
import type { AnalyticsTrack } from "../../hooks/useAnalytics";
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
  track?: AnalyticsTrack
) {
  const setup = store.studyPlanSetup;
  const level: PlanLevel = setup.level ?? "first_time";
  const minutesPerDay = setup.minutesPerDay ?? DEFAULT_MINUTES_PER_DAY;
  const daysUntilExam =
    setup.daysUntilExam ?? STUDY_PLAN_LIMITS.recommendedDays;
  const isFirstPlan = store.currentStudyPlan == null;

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

  if (isFirstPlan) {
    track?.(ANALYTICS_EVENTS.studyPlanCreated.key, {
      days_until_exam: daysUntilExam,
      has_exam_date: Boolean(setup.examDate),
      level: plan.level,
      minutes_per_day: plan.minutesPerDay,
      remote_sync_succeeded: false,
      source: "finalize_local",
    });
  }
}
