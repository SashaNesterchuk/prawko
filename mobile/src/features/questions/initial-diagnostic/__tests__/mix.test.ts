import { resolveInitialDiagnosticTopicQuota } from "../mix";

describe("initial diagnostic mix", () => {
  it("maps BRD slots onto the Polish catalog", () => {
    expect(resolveInitialDiagnosticTopicQuota("PL")).toEqual([
      "signs_signals",
      "signs_signals",
      "intersections_priority",
      "intersections_priority",
      "driving_maneuvers",
      "other_road_users",
      "accidents_first_aid",
      "vehicle_equipment",
      "transport",
    ]);
  });

  it("falls back when Czech catalog omits a BRD topic", () => {
    const quota = resolveInitialDiagnosticTopicQuota("CZ");

    expect(quota).toHaveLength(9);
    expect(quota).toContain("driving_maneuvers");
    expect(quota).toContain("documents_responsibility");
    expect(quota).not.toContain("speed_distance");
    expect(quota).not.toContain("transport");
    expect(quota.filter((id) => id === "signs_signals")).toHaveLength(2);
    expect(quota.filter((id) => id === "intersections_priority")).toHaveLength(2);
  });
});
