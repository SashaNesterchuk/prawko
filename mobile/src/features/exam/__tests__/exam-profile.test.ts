import {
  CZECH_EXAM_BASKETS,
  CZECH_EXAM_PROFILE,
  WORD_EXAM_PROFILE,
  getExamProfile,
  getExamProfileForVariant,
  readExamFlaggedOrders,
} from "../exam-profile";

describe("exam profile", () => {
  it("defaults to WORD for Prawko", () => {
    expect(getExamProfile()).toEqual(WORD_EXAM_PROFILE);
    expect(getExamProfile().navigation).toBe("forward_only");
    expect(getExamProfile().perQuestionTimer).toBe(true);
    expect(getExamProfile().totalQuestions).toBe(32);
  });

  it("uses eTesty rules for the Czech variant", () => {
    const profile = getExamProfileForVariant("czech");
    expect(profile).toEqual(CZECH_EXAM_PROFILE);
    expect(profile.navigation).toBe("free");
    expect(profile.perQuestionTimer).toBe(false);
    expect(profile.totalQuestions).toBe(25);
    expect(profile.maxPoints).toBe(50);
    expect(profile.passingPoints).toBe(43);
    expect(profile.durationMinutes).toBe(30);
    expect(
      CZECH_EXAM_BASKETS.reduce((sum, basket) => sum + basket.count, 0)
    ).toBe(25);
    expect(
      CZECH_EXAM_BASKETS.reduce(
        (sum, basket) => sum + basket.count * basket.points,
        0
      )
    ).toBe(50);
  });

  it("reads flagged orders from session metadata", () => {
    expect(readExamFlaggedOrders({ flaggedOrders: [3, 1, 1, 2] })).toEqual([
      1, 2, 3,
    ]);
    expect(readExamFlaggedOrders({})).toEqual([]);
  });
});
