import {
  createTrainingResultScoreKey,
  getTrainingResultOutcome,
  getTrainingScoreDelta,
  getTrainingScorePercent,
} from "../training/training-result-stats";

describe("training-result-stats", () => {
  it("maps percent bands to good / medium / poor", () => {
    expect(getTrainingResultOutcome(100)).toBe("good");
    expect(getTrainingResultOutcome(80)).toBe("good");
    expect(getTrainingResultOutcome(79)).toBe("medium");
    expect(getTrainingResultOutcome(60)).toBe("medium");
    expect(getTrainingResultOutcome(59)).toBe("poor");
    expect(getTrainingResultOutcome(0)).toBe("poor");
  });

  it("computes percent and delta against the previous session", () => {
    expect(getTrainingScorePercent({ correct: 5, total: 5 })).toBe(100);
    expect(getTrainingScorePercent({ correct: 3, total: 5 })).toBe(60);
    expect(getTrainingScoreDelta(100, 94)).toEqual({
      percentPoints: 6,
      previousPercent: 94,
    });
    expect(getTrainingScoreDelta(62, 74)).toEqual({
      percentPoints: -12,
      previousPercent: 74,
    });
    expect(getTrainingScoreDelta(80, 80)).toBeNull();
    expect(getTrainingScoreDelta(80, null)).toBeNull();
  });

  it("builds stable score keys by mode and topic", () => {
    expect(
      createTrainingResultScoreKey({ mode: "learning", topic: "signs" })
    ).toBe("learning:signs");
    expect(createTrainingResultScoreKey({ mode: "wrong_answers" })).toBe(
      "wrong_answers:all"
    );
  });
});
