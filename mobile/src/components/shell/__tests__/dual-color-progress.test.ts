import { resolveDualColorProgressSegments } from "../dual-color-progress";
import { resolveSignsSummaryDisplay } from "../signs-summary-display";

describe("resolveDualColorProgressSegments", () => {
  it("maps correct and wrong to percentages of total", () => {
    // 106 correct + 4 wrong out of 110 → ~96.4% green, ~3.6% red, fully filled
    expect(
      resolveDualColorProgressSegments({
        correct: 106,
        wrong: 4,
        total: 110,
      })
    ).toEqual({
      wrongPercent: (4 / 110) * 100,
      correctPercent: (106 / 110) * 100,
      filledPercent: 100,
      accessibilityText: "96% correct, 4% wrong",
    });
  });

  it("leaves gray remainder for unseen items", () => {
    // 80 correct + 15 wrong out of 95 → filled ~89.5%, gray remainder
    const result = resolveDualColorProgressSegments({
      correct: 80,
      wrong: 15,
      total: 95,
    });

    expect(result.wrongPercent).toBeCloseTo((15 / 95) * 100);
    expect(result.correctPercent).toBeCloseTo((80 / 95) * 100);
    expect(result.filledPercent).toBeCloseTo(((80 + 15) / 95) * 100);
    expect(result.accessibilityText).toBe("84% correct, 16% wrong");
  });

  it("returns zeros when nothing has been answered", () => {
    expect(
      resolveDualColorProgressSegments({
        correct: 0,
        wrong: 0,
        total: 110,
      })
    ).toEqual({
      wrongPercent: 0,
      correctPercent: 0,
      filledPercent: 0,
      accessibilityText: "0% correct, 0% wrong",
    });
  });

  it("returns zeros when total is zero or negative", () => {
    expect(
      resolveDualColorProgressSegments({
        correct: 5,
        wrong: 2,
        total: 0,
      })
    ).toEqual({
      wrongPercent: 0,
      correctPercent: 0,
      filledPercent: 0,
      accessibilityText: "0% correct, 0% wrong",
    });

    expect(
      resolveDualColorProgressSegments({
        correct: 5,
        wrong: 2,
        total: -10,
      }).filledPercent
    ).toBe(0);
  });

  it("clamps oversized segments so fill never exceeds 100%", () => {
    const result = resolveDualColorProgressSegments({
      correct: 80,
      wrong: 40,
      total: 100,
    });

    expect(result.wrongPercent).toBe(40);
    expect(result.correctPercent).toBe(60);
    expect(result.filledPercent).toBe(100);
  });

  it("ignores negative counts", () => {
    expect(
      resolveDualColorProgressSegments({
        correct: -3,
        wrong: -1,
        total: 10,
      })
    ).toEqual({
      wrongPercent: 0,
      correctPercent: 0,
      filledPercent: 0,
      accessibilityText: "0% correct, 0% wrong",
    });
  });
});

describe("resolveSignsSummaryDisplay", () => {
  it("shows learned percent from seen/total and correct/seen in the footer", () => {
    expect(
      resolveSignsSummaryDisplay({
        correct: 123,
        wrong: 18,
        seen: 141,
        total: 352,
      })
    ).toEqual({
      learnedPercent: 40,
      coverageLabel: "141 / 352",
      correctAnswersLabel: "123 / 141",
    });
  });

  it("uses correct+wrong as seen floor when seen is under-reported", () => {
    expect(
      resolveSignsSummaryDisplay({
        correct: 20,
        wrong: 12,
        seen: 0,
        total: 70,
      })
    ).toEqual({
      learnedPercent: 46,
      coverageLabel: "32 / 70",
      correctAnswersLabel: "20 / 32",
    });
  });

  it("handles empty catalog", () => {
    expect(
      resolveSignsSummaryDisplay({
        correct: 0,
        wrong: 0,
        seen: 0,
        total: 0,
      })
    ).toEqual({
      learnedPercent: 0,
      coverageLabel: "0 / 0",
      correctAnswersLabel: "0 / 0",
    });
  });

  it("shows at least 1% once any unique questions are covered", () => {
    expect(
      resolveSignsSummaryDisplay({
        correct: 2,
        wrong: 0,
        seen: 2,
        total: 2142,
      }).learnedPercent
    ).toBe(1);
  });

  it("stays at 0% when nothing has been covered", () => {
    expect(
      resolveSignsSummaryDisplay({
        correct: 0,
        wrong: 0,
        seen: 0,
        total: 2142,
      }).learnedPercent
    ).toBe(0);
  });
});
