import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CountryCode } from "@prawko/config";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { RoadmapSection } from "./roadmap";

export type RoadmapStepVisual = "active" | "completed" | "upcoming" | "premium";

const STEP_ID_PATTERN = /^(PL|CZ|SK):\d+:\d+$/;

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

type RoadmapProgressState = {
  completedStepIds: string[];
  completeStep: (id: string) => void;
};

export const useRoadmapProgressStore = create<RoadmapProgressState>()(
  persist(
    (set) => ({
      completedStepIds: [],
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
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ completedStepIds: state.completedStepIds }),
    }
  )
);
