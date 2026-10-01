import { getQuestionTopicIdsForCountry } from "@prawko/config";

import { getRoadmapTopicIds, getTopicLearnAccess } from "../roadmap";

describe("getTopicLearnAccess", () => {
  it("opens only the first slice of Signs & Signals in PL", () => {
    expect(getTopicLearnAccess("PL", "signs_signals")).toEqual({
      kind: "partial",
      freeQuestionLimit: 45,
    });
    expect(getTopicLearnAccess("PL", "intersections_priority")).toEqual({
      kind: "premium",
    });
    expect(getTopicLearnAccess("PL", "documents_responsibility")).toEqual({
      kind: "premium",
    });
    expect(getTopicLearnAccess("PL", "other_road_users")).toEqual({
      kind: "premium",
    });
    expect(getTopicLearnAccess("PL", "accidents_first_aid")).toEqual({
      kind: "premium",
    });
    expect(getTopicLearnAccess("PL", "transport")).toEqual({
      kind: "premium",
    });
  });

  it("keeps later topics premium in CZ and SK", () => {
    expect(getTopicLearnAccess("CZ", "signs_signals")).toEqual({
      kind: "partial",
      freeQuestionLimit: 36,
    });
    expect(getTopicLearnAccess("CZ", "intersections_priority")).toEqual({
      kind: "premium",
    });
    expect(getTopicLearnAccess("SK", "road_traffic_rules")).toEqual({
      kind: "partial",
      freeQuestionLimit: 36,
    });
    expect(getTopicLearnAccess("SK", "road_signs_and_traffic_devices")).toEqual({
      kind: "premium",
    });
    expect(getTopicLearnAccess("SK", "intersection_traffic_situations")).toEqual({
      kind: "premium",
    });
    expect(getTopicLearnAccess("CZ", "attention_risks")).toEqual({
      kind: "premium",
    });
    expect(getTopicLearnAccess("CZ", "accidents_first_aid")).toEqual({
      kind: "premium",
    });
  });

  it.each(["PL", "CZ", "SK"] as const)(
    "covers every %s Learn category exactly once",
    (country) => {
      const covered = getRoadmapTopicIds(country);
      const learnTopics = getQuestionTopicIdsForCountry(country);

      expect(new Set(covered)).toEqual(new Set(learnTopics));
      expect(covered).toHaveLength(learnTopics.length);
    }
  );
});
