import { EXAM_RULES } from "@prawko/config";

import {
  getExamDurationMinutes,
  getExamQuestionTarget,
  getScaledExamPassPoints,
  resolveExamLaunchFromQuestionCount,
} from "../exam-config";
import { CZECH_EXAM_PROFILE, WORD_EXAM_PROFILE } from "../exam-profile";

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

  it("uses the Czech official size when that profile is passed", () => {
    expect(resolveExamLaunchFromQuestionCount(25, CZECH_EXAM_PROFILE)).toEqual({
      mode: "exam",
    });
    expect(resolveExamLaunchFromQuestionCount(10, CZECH_EXAM_PROFILE)).toEqual({
      mode: "mini_test",
      questionLimit: 10,
    });
  });
});

describe("exam config scales from the active profile", () => {
  it("keeps WORD duration and pass points", () => {
    expect(getExamQuestionTarget("exam")).toBe(WORD_EXAM_PROFILE.totalQuestions);
    expect(getExamDurationMinutes(32, WORD_EXAM_PROFILE)).toBe(25);
    expect(getScaledExamPassPoints(74, WORD_EXAM_PROFILE)).toBe(68);
  });

  it("uses Czech 25/30min/43 on 50", () => {
    expect(getExamQuestionTarget("exam", null, CZECH_EXAM_PROFILE)).toBe(25);
    expect(getExamDurationMinutes(25, CZECH_EXAM_PROFILE)).toBe(30);
    expect(getScaledExamPassPoints(50, CZECH_EXAM_PROFILE)).toBe(43);
    expect(getExamDurationMinutes(10, CZECH_EXAM_PROFILE)).toBe(12);
  });
});
