import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CountryCode } from "@prawko/config";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { RoadmapSection } from "./roadmap";

export type RoadmapStepVisual = "active" | "completed" | "upcoming" | "premium";

const STEP_ID_PATTERN = /^(PL|CZ|SK):\d+:\d+$/;

export function hasRoadmapLearningProgress(country: string | null | undefined) {
  return country === "PL" || country === "CZ" || country === "SK";
}

function roadmapCountry(country: CountryCode | null): CountryCode {
  return country === "CZ" || country === "SK" ? country : "PL";
}

export function roadmapStepId(
  country: CountryCode | null,
  sectionIndex: number,
  stepIndex: number
) {
  return `${roadmapCountry(country)}:${sectionIndex}:${stepIndex}`;
}

export function isRoadmapStepId(value: string | null | undefined): value is string {
  return typeof value === "string" && STEP_ID_PATTERN.test(value);
}

/**
 * Green is only the current lesson or a finished one.
 * Later lessons stay open so the learner can skip ahead, but they stay gray
 * until they are current or finished. Premium lessons stay locked until Plus.
 */
export function resolveRoadmapStepVisuals(
  country: CountryCode | null,
  sections: readonly Pick<RoadmapSection, "steps">[],
  completedIds: readonly string[],
  premiumUnlocked = false
) {
  const completed = new Set(completedIds);
  let foundCurrent = false;
  let completedCount = 0;
  let totalCount = 0;

  const visuals = sections.map((section, sectionIndex) =>
    section.steps.map((step, stepIndex) => {
      totalCount += 1;
      const id = roadmapStepId(country, sectionIndex, stepIndex);

      if (completed.has(id)) {
        completedCount += 1;
        return "completed" as const;
      }

      if (step.premium && !premiumUnlocked) {
        return "premium" as const;
      }

      if (!foundCurrent) {
        foundCurrent = true;
        return "active" as const;
      }

      return "upcoming" as const;
    })
  );

  return { completedCount, totalCount, visuals };
}

export type RoadmapLesson = {
  questionIds: string[];
  correctIds: string[];
  wrongIds?: string[];
  revision: string;
};

export function roadmapLessonKey(country: string, category: string, stepId: string) {
  return `${country}:${category}:${stepId}`;
}

export function roadmapLessonCoverage(lesson: RoadmapLesson | undefined) {
  const ids = [...new Set(lesson?.questionIds ?? [])];
  const wrong = new Set(lesson?.wrongIds ?? []);
  const correct = new Set(lesson?.correctIds ?? []);
  const correctCount = ids.filter((id) => correct.has(id) && !wrong.has(id)).length;
  const wrongCount = ids.filter((id) => wrong.has(id)).length;
  return {
    correctPercent: ids.length ? 100 * correctCount / ids.length : 0,
    wrongPercent: ids.length ? 100 * wrongCount / ids.length : 0,
  };
}

export function roadmapLessonPercent(lesson: RoadmapLesson | undefined) {
  return Math.floor(roadmapLessonCoverage(lesson).correctPercent);
}

/** Each group has an equal share. A group that has not been started is 0. */
export function roadmapSectionCorrectPercent(
  steps: readonly { startsExam?: boolean }[],
  percentForStep: (stepIndex: number) => number
) {
  const percents = steps.flatMap((step, index) =>
    step.startsExam ? [] : [percentForStep(index)]
  );
  if (percents.length === 0) return 0;
  return Math.floor(percents.reduce((sum, percent) => sum + percent, 0) / percents.length);
}

/** Old answers were broadcast to overlapping lessons; their origin is unknown. */
export function removeAmbiguousRoadmapCoverage(lessons: Record<string, RoadmapLesson>) {
  const owners = new Map<string, number>();
  for (const [key, lesson] of Object.entries(lessons)) {
    const context = key.split(":").slice(0, 2).join(":");
    for (const id of new Set(lesson.questionIds)) {
      const identity = `${context}:${id}`;
      owners.set(identity, (owners.get(identity) ?? 0) + 1);
    }
  }
  return Object.fromEntries(Object.entries(lessons).map(([key, lesson]) => {
    const context = key.split(":").slice(0, 2).join(":");
    return [key, { ...lesson, correctIds: lesson.correctIds.filter((id) => owners.get(`${context}:${id}`) === 1) }];
  }));
}

type RoadmapProgressState = {
  completedStepIds: string[];
  completeStep: (id: string) => void;
  lessons: Record<string, RoadmapLesson>;
  hasStartedLearning: boolean;
  hasHydrated: boolean;
  markStarted: () => void;
  registerLesson: (key: string, lesson: RoadmapLesson) => void;
  recordAnswer: (country: string, category: string, questionId: string, isCorrect: boolean, stepId?: string | null) => void;
};

export const useRoadmapProgressStore = create<RoadmapProgressState>()(
  persist(
    (set) => ({
      completedStepIds: [],
      lessons: {},
      hasStartedLearning: false,
      hasHydrated: false,
      markStarted: () => set((state) => state.hasStartedLearning ? state : { hasStartedLearning: true }),
      registerLesson: (key, lesson) => set((state) => {
        const existing = state.lessons[key];
        return existing?.revision === lesson.revision ? state : { lessons: { ...state.lessons, [key]: lesson } };
      }),
      recordAnswer: (country, category, questionId, isCorrect, stepId) => set((state) => {
        const lessons = { ...state.lessons };
        let changed = false;
        const matches = Object.keys(lessons).filter((key) => key.startsWith(`${country}:${category}:`) && lessons[key].questionIds.includes(questionId));
        const targets = stepId ? [roadmapLessonKey(country, category, stepId)] : matches.length === 1 ? matches : [];
        for (const key of targets) {
          const lesson = lessons[key];
          if (!lesson?.questionIds.includes(questionId)) continue;
          const correctIds = lesson.correctIds.filter((id) => id !== questionId);
          const wrongIds = (lesson.wrongIds ?? []).filter((id) => id !== questionId);
          if (isCorrect) correctIds.push(questionId);
          else wrongIds.push(questionId);
          lessons[key] = { ...lesson, correctIds, wrongIds };
          changed = true;
        }
        return changed ? { lessons, hasStartedLearning: true } : state.hasStartedLearning ? state : { hasStartedLearning: true };
      }),
      completeStep: (id) => {
        if (!isRoadmapStepId(id)) {
          return;
        }

        set((state) =>
          state.completedStepIds.includes(id)
            ? state
            : { completedStepIds: [...state.completedStepIds, id] }
        );
      },
    }),
    {
      name: "prawko-roadmap-progress",
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as RoadmapProgressState;
        return { ...state, lessons: version < 1 ? removeAmbiguousRoadmapCoverage(state.lessons ?? {}) : state.lessons ?? {} };
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ completedStepIds: state.completedStepIds, lessons: state.lessons, hasStartedLearning: state.hasStartedLearning }),
      onRehydrateStorage: () => () => useRoadmapProgressStore.setState({ hasHydrated: true }),
    }
  )
);
