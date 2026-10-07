import {
  createOnboardingObservationTracker,
  isOnboardingAnalyticsStorageKey,
  onboardingObservationProperties,
} from "../onboarding-observation";
import { isDurableAnalyticsStorageKey } from "../install-observation";

const entry = { start_reason: "incomplete_onboarding_observed", reset_operation_id: null };
const acceptedAt = "2026-10-07T10:01:00.000Z";
const arrivedAt = "2026-10-07T10:02:00.000Z";

function harness() {
  const memory = new Map<string, string>();
  const storage = {
    getItem: jest.fn(async (key: string) => memory.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { memory.set(key, value); }),
  };
  let ids = 0;
  const createId = jest.fn(() => `onboarding_${++ids}`);
  const now = () => Date.parse("2026-10-07T10:00:00.000Z");
  return {
    memory, storage, createId,
    tracker: createOnboardingObservationTracker(storage, now, createId),
    reload: () => createOnboardingObservationTracker(storage, now, createId),
  };
}

describe("persistent onboarding observation", () => {
  it("shares one durable attempt through concurrent entry observations and restart", async () => {
    const { tracker, reload, storage, createId } = harness();
    const [first, second] = await Promise.all([
      tracker.resolve("usr_install", entry), tracker.resolve("usr_install", entry),
    ]);
    expect(first?.attemptId).toBe(second?.attemptId);
    expect(createId).toHaveBeenCalledTimes(1);
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    const restored = await reload().resolve("usr_install", entry);
    expect(restored?.attemptId).toBe(first?.attemptId);
    expect(restored?.detectionMethod).toBe("restored");
    expect(restored?.storageStatus).toBe("persistent");
  });

  it("serializes accepted completion and Home arrival without blocking product operations", async () => {
    const { tracker } = harness();
    const entering = tracker.resolve("usr_install", entry);
    const completing = tracker.complete("usr_install", acceptedAt);
    const arriving = tracker.home("usr_install", arrivedAt);
    const [first, completion, home] = await Promise.all([entering, completing, arriving]);
    expect(completion.changed).toBe(true);
    expect(home?.attemptId).toBe(first?.attemptId);
    expect(home?.completedAt).toBe(acceptedAt);
    expect(home?.homeObservedAt).toBe(arrivedAt);
    expect(onboardingObservationProperties(home!)).toMatchObject({
      onboarding_attempt_id: first?.attemptId,
      onboarding_storage_status: "persistent",
      onboarding_clock_order_valid: true,
    });
    expect((await tracker.complete("usr_install", acceptedAt)).changed).toBe(false);
    expect(await tracker.home("usr_install", arrivedAt)).toBeNull();
  });

  it("restores completed metadata so a later Home observation retains the origin ID", async () => {
    const { tracker, reload } = harness();
    await tracker.resolve("usr_install", entry);
    const completion = await tracker.complete("usr_install", acceptedAt);
    const home = await reload().home("usr_install", arrivedAt);
    expect(home?.attemptId).toBe(completion.observation.attemptId);
    expect(home?.completedAt).toBe(acceptedAt);
  });

  it("never infers local onboarding acceptance from a Home route or settings", async () => {
    const { tracker, storage } = harness();
    expect(await tracker.resolve("usr_existing")).toBeNull();
    expect(await tracker.home("usr_existing", arrivedAt)).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
    await tracker.resolve("usr_install", entry);
    expect(await tracker.home("usr_install", arrivedAt)).toBeNull();
    expect(tracker.peek("usr_install")?.completedAt).toBeNull();
  });

  it("creates a new analytics attempt on progress reset while retaining the installation scope", async () => {
    const { tracker, reload } = harness();
    const original = await tracker.resolve("usr_install", entry);
    await tracker.complete("usr_install", acceptedAt);
    await tracker.home("usr_install", arrivedAt);
    const reset = await tracker.resolve("usr_install", {
      start_reason: "progress_reset", reset_operation_id: "reset_1",
    });
    expect(reset?.attemptId).not.toBe(original?.attemptId);
    expect(reset?.completedAt).toBeNull();
    expect(reset?.homeObservedAt).toBeNull();
    const restored = await reload().resolve("usr_install", entry);
    expect(restored?.attemptId).toBe(reset?.attemptId);
    expect(restored?.startReason).toBe("progress_reset");
    expect(restored?.resetOperationId).toBe("reset_1");
  });

  it("does not turn an unexplained repeated onboarding into a new install or a proven reset", async () => {
    const { tracker, reload } = harness();
    await tracker.resolve("usr_install", entry);
    await tracker.complete("usr_install", acceptedAt);
    const repeated = await reload().resolve("usr_install", entry);
    expect(repeated?.startReason).toBe("repeat_incomplete_onboarding_observed");
    expect(repeated?.resetOperationId).toBeNull();
    expect(repeated?.detectionMethod).toBe("new_observation");
  });

  it("labels corrupt metadata and write failure without throwing into the caller", async () => {
    const { tracker, memory, storage } = harness();
    memory.set("prawko.analytics.onboarding.v1:usr_corrupt", "{");
    storage.setItem.mockRejectedValueOnce(new Error("disk failure"));
    const observation = await tracker.resolve("usr_corrupt", entry);
    expect(observation?.detectionMethod).toBe("storage_recovery");
    expect(observation?.storageStatus).toBe("memory_only");
    expect((await tracker.complete("usr_corrupt", acceptedAt)).observation.attemptId).toBe(observation?.attemptId);
  });

  it("retains only the known local metadata fields when restoring a record", async () => {
    const { tracker, memory, reload } = harness();
    await tracker.resolve("usr_install", entry);
    const key = "prawko.analytics.onboarding.v1:usr_install";
    memory.set(key, JSON.stringify({ ...JSON.parse(memory.get(key)!), email: "private@example.org" }));
    await reload().complete("usr_install", acceptedAt);
    expect(memory.get(key)).not.toContain("private");
    expect(memory.get(key)).not.toContain("email");
  });

  it("isolates observations for different installation IDs", async () => {
    const { tracker } = harness();
    const first = await tracker.resolve("usr_a", entry);
    const second = await tracker.resolve("usr_b", entry);
    expect(first?.attemptId).not.toBe(second?.attemptId);
    await tracker.complete("usr_a", acceptedAt);
    expect(await tracker.home("usr_b", arrivedAt)).toBeNull();
  });

  it("preserves this analytics metadata through learning reset", () => {
    const key = "prawko.analytics.onboarding.v1:usr_install";
    expect(isOnboardingAnalyticsStorageKey(key)).toBe(true);
    expect(isDurableAnalyticsStorageKey(key)).toBe(true);
    expect(isOnboardingAnalyticsStorageKey("prawko.app-shell")).toBe(false);
  });

  it("labels auto-finalization without a viewed entry and retains the actual accepted time", async () => {
    const { tracker } = harness();
    const completion = await tracker.complete("usr_install", acceptedAt);
    expect(completion.observation.startReason).toBe("completion_without_entry_observed");
    expect(completion.observation.startedAt).toBe(acceptedAt);
    expect(completion.observation.completedAt).toBe(acceptedAt);
  });

  it("flags backwards device clock ordering instead of creating a duration", async () => {
    const { tracker } = harness();
    await tracker.resolve("usr_install", entry);
    const completion = await tracker.complete("usr_install", "2026-10-06T10:00:00.000Z");
    expect(onboardingObservationProperties(completion.observation).onboarding_clock_order_valid).toBe(false);
  });
});
