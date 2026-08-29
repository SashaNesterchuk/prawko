import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type ReviewPromptState = {
  hasHydrated: boolean;
  promptedAt: string | null;
  markPrompted: () => void;
  resetPrompt: () => void;
  setHasHydrated: (value: boolean) => void;
};

export const useReviewPromptStore = create<ReviewPromptState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      promptedAt: null,
      markPrompted: () => set({ promptedAt: new Date().toISOString() }),
      resetPrompt: () => set({ promptedAt: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "prawko-review-prompt",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        promptedAt: state.promptedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export function resetReviewPromptStoreForTests() {
  useReviewPromptStore.setState({
    hasHydrated: true,
    promptedAt: null,
  });
}
