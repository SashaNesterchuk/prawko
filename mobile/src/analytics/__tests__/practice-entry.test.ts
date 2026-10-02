import { trainingPracticeEntry } from "../practice-entry";

describe("trainingPracticeEntry", () => {
  it("marks a learning session without a topic as the random set", () => {
    expect(
      trainingPracticeEntry({ mode: "learning", topicId: null, roadmapStepId: null })
    ).toEqual({ practice_entry: "random" });
  });

  it("marks a learning session opened from a topic", () => {
    expect(
      trainingPracticeEntry({ mode: "learning", topicId: "signs_signals" })
    ).toEqual({ practice_entry: "topic" });
  });

  it("marks a roadmap lesson even when that lesson has a topic", () => {
    expect(
      trainingPracticeEntry({
        mode: "learning",
        topicId: "signs_signals",
        roadmapStepId: "PL:0:1",
      })
    ).toEqual({ practice_entry: "roadmap" });
  });

  it("leaves modes that already name the opening alone", () => {
    expect(trainingPracticeEntry({ mode: "blitz" })).toEqual({});
    expect(trainingPracticeEntry({ mode: "initial_diagnostic" })).toEqual({});
  });
});
