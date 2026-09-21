import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  HomeCompletionEvent,
  HomeContextualDebugPreview,
} from "./home-contextual";
import { cycleHomeContextualDebugPreview } from "./home-contextual";

type HomeContextualState = {
  cycleDebugPreview: () => void;
  debugPreview: HomeContextualDebugPreview;
  hasHydrated: boolean;
  markCompletionShown: (id: string) => void;
  pending: HomeCompletionEvent | null;
  recordCompletion: (
    event: Omit<HomeCompletionEvent, "completedAt" | "shownOnHome"> & {
      completedAt?: number;
    }
  ) => void;
  resetHomeContextual: () => void;
  setDebugPreview: (value: HomeContextualDebugPreview) => void;
  setHasHydrated: (value: boolean) => void;
};

export const useHomeContextualStore = create<HomeContextualState>()(
  persist(
    (set, get) => ({
      cycleDebugPreview: () =>
        set((state) => ({
          debugPreview: cycleHomeContextualDebugPreview(state.debugPreview),
        })),
      debugPreview: "auto",
      hasHydrated: false,
      pending: null,
      markCompletionShown: (id) => {
        const pending = get().pending;
        if (!pending || pending.id !== id || pending.shownOnHome) {
          return;
        }

        set({
          pending: {
            ...pending,
            shownOnHome: true,
          },
        });
      },
      recordCompletion: (event) => {
        const pending = get().pending;
        if (pending?.id === event.id) {
          return;
        }

        set({
          pending: {
            ...event,
            completedAt: event.completedAt ?? Date.now(),
            shownOnHome: false,
          },
        });
      },
      resetHomeContextual: () =>
        set({
          debugPreview: "auto",
          pending: null,
        }),
      setDebugPreview: (debugPreview) => set({ debugPreview }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "prawko-home-contextual-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        pending: state.pending,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
