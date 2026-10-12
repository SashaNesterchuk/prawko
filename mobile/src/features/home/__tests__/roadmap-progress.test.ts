import { resolveRoadmapStepVisuals, roadmapSectionCorrectPercent, roadmapStepId } from "../roadmap-progress";

const sections = [
  {
    steps: [
      { premium: false },
      { premium: false },
      { premium: false },
      { premium: true },
    ],
  },
  {
    steps: [{ premium: true }, { premium: true }],
  },
];

describe("resolveRoadmapStepVisuals", () => {
  it("highlights the first unfinished free step and leaves later ones open", () => {
    expect(resolveRoadmapStepVisuals("PL", sections, []).visuals).toEqual([
      ["active", "upcoming", "upcoming", "premium"],
      ["premium", "premium"],
    ]);
  });

  it("moves the highlight to the next free step and keeps finished lessons replayable", () => {
    const completed = [roadmapStepId("PL", 0, 0)];

    expect(resolveRoadmapStepVisuals("PL", sections, completed)).toEqual({
      completedCount: 1,
      totalCount: 6,
      visuals: [
        ["completed", "active", "upcoming", "premium"],
        ["premium", "premium"],
      ],
    });
  });

  it("leaves premium steps locked after the free path is done", () => {
    const completed = [0, 1, 2].map((stepIndex) =>
      roadmapStepId("PL", 0, stepIndex)
    );

    expect(resolveRoadmapStepVisuals("PL", sections, completed).visuals[0]).toEqual([
      "completed",
      "completed",
      "completed",
      "premium",
    ]);
  });

  it("does not paint every unfinished Plus lesson green", () => {
    expect(resolveRoadmapStepVisuals("PL", sections, [], true).visuals).toEqual([
      ["active", "upcoming", "upcoming", "upcoming"],
      ["upcoming", "upcoming"],
    ]);
  });

  it("highlights only the next unfinished lesson after Plus is purchased", () => {
    const completed = [0, 1, 2].map((stepIndex) =>
      roadmapStepId("PL", 0, stepIndex)
    );

    expect(resolveRoadmapStepVisuals("PL", sections, completed, true).visuals).toEqual([
      ["completed", "completed", "completed", "active"],
      ["upcoming", "upcoming"],
    ]);
  });
});

describe("roadmapSectionCorrectPercent", () => {
  const nineGroups = Array.from({ length: 9 }, () => ({}));

  it("is zero before any group has a correct answer", () => {
    expect(roadmapSectionCorrectPercent(nineGroups, () => 0)).toBe(0);
  });

  it("gives every group an equal share of its correct answers", () => {
    expect(roadmapSectionCorrectPercent(nineGroups, (index) => (index === 0 ? 100 : 0))).toBe(11);
    expect(roadmapSectionCorrectPercent(nineGroups, (index) => (index === 0 ? 200 / 3 : 0))).toBe(7);
    expect(roadmapSectionCorrectPercent(Array.from({ length: 6 }, () => ({})), (index) => (index === 0 ? 200 / 3 : 0))).toBe(11);
    expect(roadmapSectionCorrectPercent(Array.from({ length: 10 }, () => ({})), (index) => (index === 0 ? 200 / 3 : 0))).toBe(6);
    expect(roadmapSectionCorrectPercent(nineGroups, () => 100)).toBe(100);
  });

  it("stays below 100 while any learning group is incomplete", () => {
    expect(roadmapSectionCorrectPercent(nineGroups, (index) => (index === 0 ? 99.9 : 100))).toBe(99);
  });

  it("ignores the exam step because it has no answer coverage", () => {
    expect(
      roadmapSectionCorrectPercent([...nineGroups, { startsExam: true }], (index) => (index < 9 ? 100 : 0))
    ).toBe(100);
    expect(roadmapSectionCorrectPercent([{ startsExam: true }], () => 100)).toBe(0);
  });
});
