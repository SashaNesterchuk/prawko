import {
  FIRST_START_QUESTION_COUNT,
  shouldShowHomeStartSpotlight,
} from "../first-start";

describe("home first start", () => {
  it("uses a 10-question first session", () => {
    expect(FIRST_START_QUESTION_COUNT).toBe(10);
  });

  it("shows the spotlight only on an empty, resolved Home", () => {
    expect(
      shouldShowHomeStartSpotlight({
        isReadinessEmpty: true,
        isReadinessLoading: false,
        spotlightDismissed: false,
        unlockHomeChrome: false,
      })
    ).toBe(true);
    expect(
      shouldShowHomeStartSpotlight({
        isReadinessEmpty: true,
        isReadinessLoading: true,
        spotlightDismissed: false,
        unlockHomeChrome: false,
      })
    ).toBe(false);
    expect(
      shouldShowHomeStartSpotlight({
        isReadinessEmpty: true,
        isReadinessLoading: false,
        spotlightDismissed: true,
        unlockHomeChrome: false,
      })
    ).toBe(false);
    expect(
      shouldShowHomeStartSpotlight({
        isReadinessEmpty: false,
        isReadinessLoading: false,
        spotlightDismissed: false,
        unlockHomeChrome: false,
      })
    ).toBe(false);
  });

  it("lets e2e bootstrap skip the first-start spotlight", () => {
    expect(
      shouldShowHomeStartSpotlight({
        isReadinessEmpty: true,
        isReadinessLoading: false,
        spotlightDismissed: false,
        unlockHomeChrome: true,
      })
    ).toBe(false);
  });
});
