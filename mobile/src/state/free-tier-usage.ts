import AsyncStorage from "@react-native-async-storage/async-storage";
import { FREE_TIER_LIMITS } from "@prawko/config";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type FreeTierQuestionUsageState = {
  answeredQuestionsByDate: Record<string, number>;
  hasHydrated: boolean;
  /** Deprecated legacy helper; active product flows no longer rely on daily caps. */
  consumeQuestionAnswer: () => number;
  /** Deprecated legacy helper; active product flows no longer rely on daily caps. */
  getUsedQuestionAnswersToday: () => number;
  /** Deprecated legacy helper; active product flows no longer rely on daily caps. */
  getRemainingQuestionAnswers: () => number;
  setHasHydrated: (value: boolean) => void;
};

export const useFreeTierQuestionUsageStore = create<FreeTierQuestionUsageState>()(
  persist(
    (set, get) => ({
      answeredQuestionsByDate: {},
      hasHydrated: false,
      consumeQuestionAnswer: () => {
        const state = get();
        const todayKey = getTodayKey();
        const nextUsed = (state.answeredQuestionsByDate[todayKey] ?? 0) + 1;

        set({
          answeredQuestionsByDate: {
            ...state.answeredQuestionsByDate,
            [todayKey]: nextUsed,
          },
        });

        return Math.max(0, FREE_TIER_LIMITS.questionPracticePerDay - nextUsed);
      },
      getUsedQuestionAnswersToday: () =>
        get().answeredQuestionsByDate[getTodayKey()] ?? 0,
      getRemainingQuestionAnswers: () => {
        const usedToday = get().answeredQuestionsByDate[getTodayKey()] ?? 0;

        return Math.max(0, FREE_TIER_LIMITS.questionPracticePerDay - usedToday);
      },
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "prawko-free-tier-usage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        answeredQuestionsByDate: state.answeredQuestionsByDate,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export function useFreeTierQuestionUsageHydrated() {
  return useFreeTierQuestionUsageStore((state) => state.hasHydrated);
}

export function useRemainingFreeQuestionAnswers() {
  return useFreeTierQuestionUsageStore((state) =>
    state.getRemainingQuestionAnswers()
  );
}

export function useUsedFreeQuestionAnswersToday() {
  return useFreeTierQuestionUsageStore((state) =>
    state.getUsedQuestionAnswersToday()
  );
}

// Called from store selectors, which re-run on every state change.
let todayKeyFormatter: Intl.DateTimeFormat | null = null;

function getTodayKey() {
  todayKeyFormatter ??= new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Warsaw",
  });

  return todayKeyFormatter.format(new Date());
}
