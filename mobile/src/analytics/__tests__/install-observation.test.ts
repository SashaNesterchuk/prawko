import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getInstallObservationProperties, isDurableAnalyticsStorageKey, resolveInstallObservation,
} from "../install-observation";

describe("persistent first-observed metadata", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it("keeps first observation distinct from native install time", async () => {
    const result = await resolveInstallObservation("usr_first", async () => new Date("2026-09-01T10:00:00Z"),
      () => Date.parse("2026-10-07T10:00:00Z"));
    expect(result.firstObservedAt).toBe("2026-10-07T10:00:00.000Z");
    expect(result.nativeInstalledAt).toBe("2026-09-01T10:00:00.000Z");
    expect(getInstallObservationProperties("usr_first")).toMatchObject({
      observation_detection_method: "first_local_observation", identity_scope: "install",
    });
  });

  it("reads the previous anchor without requesting a new native installation time", async () => {
    const saved = {
      version: 1, observationId: "installation-known", firstObservedAt: "2026-10-01T10:00:00.000Z",
      nativeInstalledAt: null, detectionMethod: "first_local_observation",
    };
    await AsyncStorage.setItem("prawko.analytics.install-observation.v1:usr_existing", JSON.stringify(saved));
    const native = jest.fn(async () => new Date());
    expect(await resolveInstallObservation("usr_existing", native)).toEqual(saved);
    expect(native).not.toHaveBeenCalled();
  });

  it("serializes concurrent resolution and labels corrupt storage as recovery", async () => {
    await AsyncStorage.setItem("prawko.analytics.install-observation.v1:usr_corrupt", "{");
    const native = jest.fn(async () => null);
    const [first, second] = await Promise.all([
      resolveInstallObservation("usr_corrupt", native), resolveInstallObservation("usr_corrupt", native),
    ]);
    expect(first).toBe(second);
    expect(first.detectionMethod).toBe("storage_recovery");
    expect(native).toHaveBeenCalledTimes(1);
  });

  it("does not call a failed storage write a durable cohort anchor", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk unavailable"));
    const result = await resolveInstallObservation("usr_memory", async () => null);
    expect(result.detectionMethod).toBe("memory_only");
    expect(getInstallObservationProperties("not-observed").first_observed_at).toBeNull();
  });

  it("preserves only analytics lifetime metadata during a learning reset", () => {
    expect(isDurableAnalyticsStorageKey("prawko.analytics.install-observation.v1:usr_install")).toBe(true);
    expect(isDurableAnalyticsStorageKey("prawko.analytics.collection.v1")).toBe(true);
    expect(isDurableAnalyticsStorageKey("prawko.question-progress")).toBe(false);
  });
});
