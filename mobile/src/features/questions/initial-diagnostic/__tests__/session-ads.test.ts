import { shouldAutoShowPracticeSessionCompleteAd } from "../session-ads";

describe("diagnostic practice ads", () => {
  it("does not auto-show the practice-complete interstitial after the diagnostic", () => {
    expect(shouldAutoShowPracticeSessionCompleteAd("initial_diagnostic")).toBe(
      false
    );
  });

  it("leaves exam and regular training ads unchanged", () => {
    expect(shouldAutoShowPracticeSessionCompleteAd("mini_test")).toBe(true);
    expect(shouldAutoShowPracticeSessionCompleteAd("learning")).toBe(true);
    expect(shouldAutoShowPracticeSessionCompleteAd("exam")).toBe(true);
  });
});
