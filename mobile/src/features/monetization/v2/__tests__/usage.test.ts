import {
  canOfferRewardedExam,
  capTrainingQuestionIds,
  capWrongAnswersPreview,
  commitExamStarted,
  createEmptyMonetizationUsage,
  freeQuestionsRemaining,
  grantRewardedExamCredit,
  mergeMonetizationUsage,
  recordFreeQuestion,
  resolveExamStart,
  resolveExplanationAccess,
  resolveTrainingStart,
} from "../usage";

function usageWith(patch: Partial<ReturnType<typeof createEmptyMonetizationUsage>>) {
  return { ...createEmptyMonetizationUsage(), ...patch };
}

describe("monetization v2 usage", () => {
  it("counts a question id once", () => {
    const once = recordFreeQuestion(createEmptyMonetizationUsage(), "q1");
    const twice = recordFreeQuestion(once, "q1");

    expect(twice.freeQuestionIds).toEqual(["q1"]);
    expect(freeQuestionsRemaining(twice)).toBe(49);
  });

  it("caps a new session to the remaining unique questions", () => {
    const usage = usageWith({
      freeQuestionIds: Array.from({ length: 43 }, (_, index) => `seen-${index}`),
    });
    const requested = Array.from({ length: 20 }, (_, index) => `new-${index}`);

    expect(capTrainingQuestionIds(requested, usage)).toHaveLength(7);
  });

  it("does not start training when the unique quota is empty", () => {
    const usage = usageWith({
      freeQuestionIds: Array.from({ length: 50 }, (_, index) => `q-${index}`),
    });

    expect(capTrainingQuestionIds(["fresh"], usage)).toEqual([]);
  });

  it("keeps already counted questions inside a capped session", () => {
    const usage = usageWith({
      freeQuestionIds: ["seen", ...Array.from({ length: 46 }, (_, index) => `old-${index}`)],
    });
    const capped = capTrainingQuestionIds(
      ["seen", "new-1", "new-2", "new-3", "new-4"],
      usage
    );

    expect(capped).toEqual(["seen", "new-1", "new-2", "new-3"]);
  });

  it("locks every explanation unless the learner has Premium", () => {
    const usage = createEmptyMonetizationUsage();

    expect(resolveExplanationAccess(usage, "q-0", false).kind).toBe("locked");
    expect(resolveExplanationAccess(usage, "q-0", true).kind).toBe("premium");
  });

  it("gives one free exam, then a sheet, then a credited rewarded exam", () => {
    const fresh = createEmptyMonetizationUsage();
    expect(resolveExamStart({ isPlus: false, isResume: false, usage: fresh })).toEqual({
      action: "start",
      method: "free_initial",
    });

    const used = commitExamStarted(fresh, "free_initial", "2026-09-24");
    expect(used.freeExamUsed).toBe(true);
    expect(resolveExamStart({ isPlus: false, isResume: false, usage: used }).action).toBe(
      "sheet"
    );

    const credited = grantRewardedExamCredit(used);
    expect(credited.rewardedExamUnlocksTotal).toBe(0);
    expect(
      resolveExamStart({ isPlus: false, isResume: false, usage: credited })
    ).toEqual({ action: "start", method: "rewarded" });

    const started = commitExamStarted(credited, "rewarded", "2026-09-24");
    expect(started.rewardedExamCredit).toBe(0);
    expect(started.rewardedExamUnlocksTotal).toBe(1);
    expect(started.rewardedExamUnlocksToday).toBe(1);
    expect(canOfferRewardedExam(started, "2026-09-24")).toBe(false);
    expect(canOfferRewardedExam(started, "2026-09-25")).toBe(true);
  });

  it("hides the reward after three lifetime unlocks", () => {
    const usage = usageWith({
      rewardedExamUnlocksTotal: 3,
      rewardedExamUnlockDate: "2026-09-20",
      rewardedExamUnlocksToday: 0,
    });

    expect(canOfferRewardedExam(usage, "2026-09-24")).toBe(false);
  });

  it("keeps a rewarded credit when the exam was not started", () => {
    const credited = grantRewardedExamCredit(
      usageWith({ freeExamUsed: true })
    );

    expect(credited.rewardedExamCredit).toBe(1);
    expect(credited.rewardedExamUnlocksTotal).toBe(0);
  });

  it("previews five wrong answers", () => {
    expect(capWrongAnswersPreview(["a", "b", "c", "d", "e", "f"])).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("merges guest usage so login cannot reset the free pack", () => {
    const merged = mergeMonetizationUsage(
      usageWith({
        freeQuestionIds: ["a", "b"],
        freeExplanationsUsed: 2,
        freeExplanationQuestionIds: ["e1", "e2"],
        freeExamUsed: false,
        wrongAnswersPreviewUsed: false,
        rewardedExamUnlocksTotal: 1,
        rewardedExamCredit: 1,
      }),
      usageWith({
        freeQuestionIds: ["b", "c"],
        freeExplanationsUsed: 4,
        freeExplanationQuestionIds: ["e2", "e3"],
        freeExamUsed: true,
        wrongAnswersPreviewUsed: true,
        rewardedExamUnlocksTotal: 0,
        rewardedExamCredit: 0,
      })
    );

    expect(merged.freeQuestionIds).toEqual(["a", "b", "c"]);
    expect(merged.freeExplanationsUsed).toBe(4);
    expect(merged.freeExamUsed).toBe(true);
    expect(merged.wrongAnswersPreviewUsed).toBe(true);
    expect(merged.rewardedExamUnlocksTotal).toBe(1);
    expect(merged.rewardedExamCredit).toBe(1);
  });

  it("keeps saved questions outside the free pool", () => {
    const exhausted = usageWith({
      freeQuestionIds: Array.from({ length: 50 }, (_, index) => `q-${index}`),
    });

    expect(
      resolveTrainingStart({
        isPlus: false,
        mode: "saved",
        questionLimit: null,
        usage: exhausted,
        v2: true,
      })
    ).toEqual({
      action: "start",
      accessMethod: "free_quota",
      questionLimit: null,
    });
  });

  it("sells smart reviews and trap questions", () => {
    const usage = createEmptyMonetizationUsage();

    expect(
      resolveTrainingStart({
        isPlus: false,
        mode: "review_due",
        questionLimit: null,
        usage,
        v2: true,
      })
    ).toEqual({ action: "paywall", source: "smart_reviews" });
    expect(
      resolveTrainingStart({
        isPlus: false,
        mode: "high_points",
        questionLimit: 10,
        usage,
        v2: true,
      })
    ).toEqual({ action: "paywall", source: "trap_questions" });
  });

  it("still starts training from the remaining free pool", () => {
    expect(
      resolveTrainingStart({
        isPlus: false,
        mode: "learning",
        questionLimit: null,
        usage: createEmptyMonetizationUsage(),
        v2: true,
      })
    ).toEqual({
      action: "start",
      accessMethod: "free_quota",
      questionLimit: 50,
    });
  });

  it("caps a free topic slice below the unique pool", () => {
    expect(
      resolveTrainingStart({
        isPlus: false,
        mode: "learning",
        questionLimit: null,
        topicFreeQuestionLimit: 45,
        usage: createEmptyMonetizationUsage(),
        v2: true,
      })
    ).toEqual({
      action: "start",
      accessMethod: "free_quota",
      questionLimit: 45,
    });
  });

  it("leaves the full queue open after Plus", () => {
    expect(
      resolveTrainingStart({
        isPlus: true,
        mode: "learning",
        questionLimit: null,
        topicFreeQuestionLimit: 45,
        usage: createEmptyMonetizationUsage(),
        v2: true,
      })
    ).toEqual({
      action: "start",
      accessMethod: "premium",
      questionLimit: null,
    });
    expect(
      resolveTrainingStart({
        isPlus: true,
        mode: "weak_spots",
        questionLimit: null,
        usage: createEmptyMonetizationUsage(),
        v2: true,
      }).action
    ).toBe("start");
    expect(
      resolveTrainingStart({
        isPlus: true,
        mode: "exam",
        questionLimit: null,
        usage: createEmptyMonetizationUsage(),
        v2: true,
      }).action
    ).toBe("start");
  });

  it("keeps question-mode exams behind Plus", () => {
    const usage = createEmptyMonetizationUsage();

    expect(
      resolveTrainingStart({
        isPlus: false,
        mode: "exam",
        questionLimit: null,
        usage,
        v2: true,
      })
    ).toEqual({ action: "paywall", source: "exam_limit" });
    expect(
      resolveTrainingStart({
        isPlus: false,
        mode: "mini_test",
        questionLimit: 10,
        usage,
        v2: true,
      })
    ).toEqual({ action: "paywall", source: "exam_limit" });
  });
});
