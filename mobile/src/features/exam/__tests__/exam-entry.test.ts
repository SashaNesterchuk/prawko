import {
  examAnalyticsFromMetadata,
  examAnalyticsFromRoute,
  examCompletionAnalytics,
  isExamEntry,
} from "../exam-entry";

describe("exam entry analytics", () => {
  it("keeps a known route entry and the roadmap step", () => {
    expect(
      examAnalyticsFromRoute({
        entry: "roadmap_simulator",
        roadmapStepId: "PL:7:2",
      })
    ).toEqual({
      exam_entry: "roadmap_simulator",
      roadmap_step_id: "PL:7:2",
    });
  });

  it("marks a missing route entry instead of calling it manual", () => {
    expect(examAnalyticsFromRoute({ entry: null })).toEqual({
      exam_entry: "unspecified",
    });
    expect(isExamEntry("practice")).toBe(true);
    expect(isExamEntry("manual")).toBe(false);
  });

  it("reads the entry stored on the session", () => {
    expect(
      examAnalyticsFromMetadata({
        exam_entry: "practice",
        source: "mobile_local_exam",
      })
    ).toEqual({ exam_entry: "practice" });
  });

  it("does not treat an opened result as a finish", () => {
    expect(
      examCompletionAnalytics({
        justFinished: false,
        metadata: { exam_entry: "practice" },
      })
    ).toBeNull();
    expect(
      examCompletionAnalytics({
        justFinished: true,
        metadata: { exam_entry: "learn", roadmap_step_id: "PL:1:0" },
      })
    ).toEqual({
      exam_entry: "learn",
      roadmap_step_id: "PL:1:0",
    });
  });
});
