import { resolveRoadmapStepVisuals, roadmapStepId } from "../roadmap-progress";

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
