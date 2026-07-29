import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type SignBookmarksState = {
  savedSignIds: Record<string, true>;
  isSaved: (signId: string) => boolean;
  toggleSaved: (signId: string) => boolean;
  resetSaved: () => void;
};

export const useSignBookmarksStore = create<SignBookmarksState>()(
  persist(
    (set, get) => ({
      savedSignIds: {},
      isSaved: (signId) => Boolean(get().savedSignIds[signId]),
      toggleSaved: (signId) => {
        if (!signId) {
          return false;
        }

        const isCurrentlySaved = Boolean(get().savedSignIds[signId]);
        const nextValue = !isCurrentlySaved;

        set((state) => {
          const nextSavedSignIds = { ...state.savedSignIds };

          if (nextValue) {
            nextSavedSignIds[signId] = true;
          } else {
            delete nextSavedSignIds[signId];
          }

          return { savedSignIds: nextSavedSignIds };
        });

        return nextValue;
      },
      resetSaved: () => set({ savedSignIds: {} }),
    }),
    {
      name: "road-sign-bookmarks-v1",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
