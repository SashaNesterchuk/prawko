import { resolveLearnerExplanationAccess } from "../explanation-access";

describe("resolveLearnerExplanationAccess", () => {
  it("opens a Poland free topic and only marks it as Premium", () => {
    expect(
      resolveLearnerExplanationAccess({
        country: "PL",
        hasPlusAccess: false,
        topicIds: ["signs_signals"],
      })
    ).toBe("preview");
  });

  it("keeps other Poland topics locked", () => {
    expect(
      resolveLearnerExplanationAccess({
        country: "PL",
        hasPlusAccess: false,
        topicIds: ["intersections_priority"],
      })
    ).toBe("locked");
  });

  it("opens every topic once Premium is active", () => {
    expect(
      resolveLearnerExplanationAccess({
        country: "PL",
        hasPlusAccess: true,
        topicIds: ["intersections_priority"],
      })
    ).toBe("open");
    expect(
      resolveLearnerExplanationAccess({
        country: "CZ",
        hasPlusAccess: true,
        topicIds: ["signs_signals"],
      })
    ).toBe("open");
  });

  it("keeps Czech and Slovak free topics locked", () => {
    expect(
      resolveLearnerExplanationAccess({
        country: "CZ",
        hasPlusAccess: false,
        topicIds: ["signs_signals"],
      })
    ).toBe("locked");
    expect(
      resolveLearnerExplanationAccess({
        country: "SK",
        hasPlusAccess: false,
        topicIds: ["road_traffic_rules"],
      })
    ).toBe("locked");
  });

  it("treats a question that also belongs to the free topic as open", () => {
    expect(
      resolveLearnerExplanationAccess({
        country: "PL",
        hasPlusAccess: false,
        topicIds: ["intersections_priority", "signs_signals"],
      })
    ).toBe("preview");
  });
});
