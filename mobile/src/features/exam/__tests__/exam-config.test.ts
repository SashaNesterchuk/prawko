import { EXAM_RULES } from "@prawko/config";

import { resolveExamLaunchFromQuestionCount } from "../exam-config";

describe("resolveExamLaunchFromQuestionCount", () => {
  it("keeps the official simulator for all / full size", () => {
    expect(resolveExamLaunchFromQuestionCount("all")).toEqual({
      mode: "exam",
    });
    expect(
      resolveExamLaunchFromQuestionCount(EXAM_RULES.totalQuestions)
    ).toEqual({ mode: "exam" });
  });

  it("starts a timed mini test for smaller presets", () => {
    expect(resolveExamLaunchFromQuestionCount(10)).toEqual({
      mode: "mini_test",
      questionLimit: 10,
    });
    expect(resolveExamLaunchFromQuestionCount(20)).toEqual({
      mode: "mini_test",
      questionLimit: 20,
    });
  });
});
