import {
  ACTIVE_CATEGORIES,
  DEFAULT_CATEGORY,
  QUESTION_TOPIC_IDS,
  STUDY_PLAN_LIMITS,
  type DrivingCategory,
  type SupportedLocale,
} from "@prawko/config";
import type { Href } from "expo-router";

import { finalizeLocalOnboarding } from "../../features/onboarding/finalize-local-onboarding";
import { isRoadSignCategoryId } from "../../features/road-signs/catalog";
import { getExamDateFromDays } from "../../features/study-plan/generate-local-study-plan";
import { useAppShellStore } from "../../state/app-shell";

export type E2EDestination =
  | "home"
  | "learn"
  | "practice"
  | "profile"
  | "statistics"
  | "signs"
  | "signs-category"
  | "topic"
  | "topics"
  | "trainer-modes";

type PrepareE2EAppStateInput = {
  category?: string | null;
  daysUntilExam?: number | null;
  locale?: SupportedLocale | null;
};

type ResolveE2EDestinationInput = {
  destination?: string | null;
  signCategoryId?: string | null;
  topicId?: string | null;
};

export function prepareE2EAppState(
  input: PrepareE2EAppStateInput = {},
) {
  const store = useAppShellStore.getState();
  const preferredCategory = resolveCategory(input.category);
  const daysUntilExam = resolveDaysUntilExam(input.daysUntilExam);

  store.setSessionResolved(true);
  store.setPreferredCategory(preferredCategory);
  store.completeCategoryStep();

  if (input.locale) {
    store.setPreferredLocale(input.locale);
  }

  store.setExamSchedule({
    daysUntilExam,
    examDate: getExamDateFromDays(daysUntilExam),
  });

  finalizeLocalOnboarding();
}

export function resolveE2EDestination(
  input: ResolveE2EDestinationInput = {},
): Href {
  switch (normalizeDestination(input.destination)) {
    case "learn":
      return "/(tabs)/learn";
    case "profile":
      return "/(tabs)/profile";
    case "practice":
      return "/practice";
    case "statistics":
      return "/statistics";
    case "signs":
      return "/(tabs)/signs";
    case "signs-category":
      return {
        pathname: "/signs/category/[categoryId]",
        params: {
          categoryId: resolveSignCategoryId(input.signCategoryId),
        },
      };
    case "topic":
      return {
        pathname: "/topic/[topicId]",
        params: {
          topicId: resolveTopicId(input.topicId),
        },
      };
    case "topics":
      return "/topics";
    case "trainer-modes":
      return "/trainer-modes";
    case "home":
    default:
      return "/(tabs)";
  }
}

function normalizeDestination(
  value: string | null | undefined,
): E2EDestination {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "learn":
    case "practice":
    case "profile":
    case "statistics":
    case "signs":
    case "signs-category":
    case "topic":
    case "topics":
    case "trainer-modes":
      return normalized;
    case "home":
    default:
      return "home";
  }
}

function resolveCategory(value: string | null | undefined): DrivingCategory {
  const candidate = value?.trim().toUpperCase() as DrivingCategory | undefined;

  return candidate && ACTIVE_CATEGORIES.includes(candidate)
    ? candidate
    : DEFAULT_CATEGORY;
}

function resolveDaysUntilExam(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return STUDY_PLAN_LIMITS.recommendedDays;
  }

  return Math.max(1, Math.round(value));
}

function resolveSignCategoryId(value: string | null | undefined) {
  return value && isRoadSignCategoryId(value) ? value : "A";
}

function resolveTopicId(value: string | null | undefined) {
  return value && QUESTION_TOPIC_IDS.includes(value as (typeof QUESTION_TOPIC_IDS)[number])
    ? value
    : QUESTION_TOPIC_IDS[0];
}
