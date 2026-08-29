import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Last resolved Home readiness index. The question progress blob and the
 * remote catalog both take seconds to become trustworthy on a cold start, so
 * this tiny snapshot is what the card paints on the first frame.
 */
export type ReadinessSnapshot = {
  isEmpty: boolean;
  percent: number;
  seen: number;
  total: number;
  weekChangePercent: number | null;
  weekChangePeriodDays: number | null;
  /** Guards against painting the previous account's numbers after a switch. */
  userId: string | null;
};

type ReadinessSnapshotState = {
  hasHydrated: boolean;
  snapshot: ReadinessSnapshot | null;
  saveSnapshot: (snapshot: ReadinessSnapshot) => void;
  clearSnapshot: () => void;
  setHasHydrated: (value: boolean) => void;
};

export const useReadinessSnapshotStore = create<ReadinessSnapshotState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      snapshot: null,
      saveSnapshot: (snapshot) => {
        if (areReadinessSnapshotsEqual(get().snapshot, snapshot)) {
          return;
        }

        set({ snapshot });
      },
      clearSnapshot: () => set({ snapshot: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "prawko-readiness-snapshot:PL",
      skipHydration: true,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        snapshot: state.snapshot,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export function useReadinessSnapshot() {
  return useReadinessSnapshotStore((state) => state.snapshot);
}

export function useReadinessSnapshotHydrated() {
  return useReadinessSnapshotStore((state) => state.hasHydrated);
}

export function areReadinessSnapshotsEqual(
  left: ReadinessSnapshot | null,
  right: ReadinessSnapshot | null
) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.isEmpty === right.isEmpty &&
    left.percent === right.percent &&
    left.seen === right.seen &&
    left.total === right.total &&
    left.weekChangePercent === right.weekChangePercent &&
    left.weekChangePeriodDays === right.weekChangePeriodDays &&
    left.userId === right.userId
  );
}

/**
 * Picks what the readiness card paints. Live values win once the progress
 * store rehydrated and the catalog resolved; until then the persisted snapshot
 * stands in. Returning null means there is nothing known yet.
 */
export function resolveReadinessView(input: {
  live: ReadinessSnapshot;
  snapshot: ReadinessSnapshot | null;
  currentUserId: string | null;
  isLiveResolved: boolean;
  isProgressHydrated: boolean;
  isSnapshotHydrated: boolean;
}): ReadinessSnapshot | null {
  const {
    live,
    snapshot,
    currentUserId,
    isLiveResolved,
    isProgressHydrated,
    isSnapshotHydrated,
  } = input;

  if (isLiveResolved) {
    return live;
  }

  if (isSnapshotHydrated && snapshot && snapshot.userId === currentUserId) {
    return snapshot;
  }

  // No usable snapshot: local progress alone still beats waiting for the
  // catalog round trip, which can take seconds.
  if (isProgressHydrated && isSnapshotHydrated) {
    return live;
  }

  return null;
}
