import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SignPracticeOutcome = "mastered" | "wrong";

export type SignPracticeRecord = {
  signId: string;
  attempts: number;
  lastCompletedAt: string;
  lastCorrectCount: number;
  lastTotalQuestions: number;
  lastOutcome: SignPracticeOutcome;
};

type RecordAttemptPayload = {
  signId: string;
  correctCount: number;
  totalQuestions: number;
  completedAt?: string;
};

type SignPracticeProgressState = {
  records: Record<string, SignPracticeRecord>;
  recordAttempt: (payload: RecordAttemptPayload) => SignPracticeRecord | null;
  resetProgress: () => void;
};

function resolveOutcome(
  correctCount: number,
  totalQuestions: number
): SignPracticeOutcome {
  return totalQuestions > 0 && correctCount === totalQuestions
    ? "mastered"
    : "wrong";
}

export const useSignPracticeProgressStore =
  create<SignPracticeProgressState>()(
    persist(
      (set, get) => ({
        records: {},
        recordAttempt: ({
          signId,
          correctCount,
          totalQuestions,
          completedAt,
        }) => {
          if (!signId || totalQuestions <= 0) {
            return null;
          }

          const previousRecord = get().records[signId];
          const nextRecord: SignPracticeRecord = {
            signId,
            attempts: (previousRecord?.attempts ?? 0) + 1,
            lastCompletedAt: completedAt ?? new Date().toISOString(),
            lastCorrectCount: correctCount,
            lastTotalQuestions: totalQuestions,
            lastOutcome: resolveOutcome(correctCount, totalQuestions),
          };

          set((state) => ({
            records: {
              ...state.records,
              [signId]: nextRecord,
            },
          }));

          return nextRecord;
        },
        resetProgress: () => set({ records: {} }),
      }),
      {
        name: "road-sign-practice-progress-v1:PL",
        skipHydration: true,
        storage: createJSONStorage(() => AsyncStorage),
      }
    )
  );
