import {
  areReadinessSnapshotsEqual,
  resolveReadinessView,
  type ReadinessSnapshot,
} from "../readiness-snapshot";

function buildSnapshot(
  overrides: Partial<ReadinessSnapshot> = {}
): ReadinessSnapshot {
  return {
    isEmpty: false,
    percent: 42,
    seen: 900,
    total: 2142,
    weekChangePercent: 3,
    weekChangePeriodDays: 7,
    userId: "user-1",
    ...overrides,
  };
}

describe("resolveReadinessView", () => {
  const live = buildSnapshot({ percent: 55, seen: 1200 });

  it("paints the persisted snapshot while the live values are still settling", () => {
    const snapshot = buildSnapshot();

    expect(
      resolveReadinessView({
        live,
        snapshot,
        currentUserId: "user-1",
        isLiveResolved: false,
        isProgressHydrated: false,
        isSnapshotHydrated: true,
      })
    ).toBe(snapshot);
  });

  it("switches to live values once progress hydrated and the catalog resolved", () => {
    expect(
      resolveReadinessView({
        live,
        snapshot: buildSnapshot(),
        currentUserId: "user-1",
        isLiveResolved: true,
        isProgressHydrated: true,
        isSnapshotHydrated: true,
      })
    ).toBe(live);
  });

  it("ignores a snapshot left behind by another account", () => {
    expect(
      resolveReadinessView({
        live,
        snapshot: buildSnapshot({ userId: "user-2" }),
        currentUserId: "user-1",
        isLiveResolved: false,
        isProgressHydrated: true,
        isSnapshotHydrated: true,
      })
    ).toBe(live);
  });

  it("falls back to local progress when no snapshot exists yet", () => {
    expect(
      resolveReadinessView({
        live,
        snapshot: null,
        currentUserId: null,
        isLiveResolved: false,
        isProgressHydrated: true,
        isSnapshotHydrated: true,
      })
    ).toBe(live);
  });

  it("reports nothing to paint before either store rehydrated", () => {
    expect(
      resolveReadinessView({
        live,
        snapshot: null,
        currentUserId: null,
        isLiveResolved: false,
        isProgressHydrated: false,
        isSnapshotHydrated: false,
      })
    ).toBeNull();
  });
});

describe("areReadinessSnapshotsEqual", () => {
  it("treats structurally identical snapshots as equal", () => {
    expect(
      areReadinessSnapshotsEqual(buildSnapshot(), buildSnapshot())
    ).toBe(true);
  });

  it("detects a changed covered count", () => {
    expect(
      areReadinessSnapshotsEqual(buildSnapshot(), buildSnapshot({ seen: 901 }))
    ).toBe(false);
  });
});
