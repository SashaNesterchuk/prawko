import AsyncStorage from "@react-native-async-storage/async-storage";
import { FEATURE_FLAGS } from "@prawko/config";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useHasPlusAccess } from "../../../state/entitlements";
import { getE2EMonetizationV2Override } from "../../../testing/e2e/state";
import {
  readMonetizationV2Cohort,
  type MonetizationV2Cohort,
} from "./cohort";
import {
  commitExamStarted,
  createEmptyMonetizationUsage,
  grantRewardedExamCredit,
  recordFreeQuestion,
  resolveExplanationAccess,
  type ExamAccessMethod,
  type MonetizationUsage,
} from "./usage";

type MonetizationV2State = {
  cohort: MonetizationV2Cohort | null;
  hasHydrated: boolean;
  usage: MonetizationUsage;
  commitExamStarted: (method: ExamAccessMethod) => void;
  grantRewardedCredit: () => void;
  markWrongAnswersPreviewUsed: () => void;
  recordExplanation: (questionId: string, isPlus: boolean) => ReturnType<
    typeof resolveExplanationAccess
  >;
  recordTrainingQuestion: (questionId: string) => void;
  replaceUsage: (usage: MonetizationUsage) => void;
  setCohort: (cohort: MonetizationV2Cohort | null) => void;
  setHasHydrated: (value: boolean) => void;
};

export const useMonetizationV2Store = create<MonetizationV2State>()(
  persist(
    (set, get) => ({
      cohort: null,
      hasHydrated: false,
      usage: createEmptyMonetizationUsage(),
      commitExamStarted: (method) =>
        set({ usage: commitExamStarted(get().usage, method) }),
      grantRewardedCredit: () =>
        set({ usage: grantRewardedExamCredit(get().usage) }),
      markWrongAnswersPreviewUsed: () =>
        set({
          usage: { ...get().usage, wrongAnswersPreviewUsed: true },
        }),
      recordExplanation: (questionId, isPlus) => {
        const access = resolveExplanationAccess(get().usage, questionId, isPlus);

        if (access.kind === "free" && access.usage !== get().usage) {
          set({ usage: access.usage });
        }

        return access;
      },
      recordTrainingQuestion: (questionId) =>
        set({ usage: recordFreeQuestion(get().usage, questionId) }),
      replaceUsage: (usage) => set({ usage }),
      setCohort: (cohort) => set({ cohort }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "prawko-monetization-v2-usage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ usage: state.usage }),
      onRehydrateStorage: () => (state) => {
        void readMonetizationV2Cohort().then((cohort) => {
          useMonetizationV2Store.setState({
            cohort,
            hasHydrated: true,
          });
          state?.setHasHydrated(true);
        });
      },
    }
  )
);

export function isMonetizationV2Active() {
  if (!FEATURE_FLAGS.monetizationV2) {
    return false;
  }

  const e2eOverride = getE2EMonetizationV2Override();

  if (e2eOverride !== null) {
    return e2eOverride;
  }

  return true;
}

export function useMonetizationV2Active() {
  return isMonetizationV2Active();
}

/** Green crown on a feature that stays locked until Premium is purchased. */
export function useShowPremiumMark() {
  const hasPlusAccess = useHasPlusAccess();
  return useMonetizationV2Active() && !hasPlusAccess;
}
