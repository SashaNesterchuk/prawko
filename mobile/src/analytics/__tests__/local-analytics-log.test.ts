import { isLocalAnalyticsLogEnabled } from "../local-analytics-log";

describe("isLocalAnalyticsLogEnabled", () => {
  it("records a Metro session that is not allowed to send PostHog", () => {
    expect(
      isLocalAnalyticsLogEnabled({
        isDevBuild: true,
        isE2ETestMode: false,
        posthogCaptureEnabled: false,
      })
    ).toBe(true);
  });

  it("records an e2e binary that is not a dev build", () => {
    expect(
      isLocalAnalyticsLogEnabled({
        isDevBuild: false,
        isE2ETestMode: true,
        posthogCaptureEnabled: false,
      })
    ).toBe(true);
  });

  it("stays off for a production capture build", () => {
    expect(
      isLocalAnalyticsLogEnabled({
        isDevBuild: false,
        isE2ETestMode: false,
        posthogCaptureEnabled: true,
      })
    ).toBe(false);
  });

  it("stays off on TestFlight, where there is no local file to write", () => {
    expect(
      isLocalAnalyticsLogEnabled({
        isDevBuild: false,
        isE2ETestMode: false,
        posthogCaptureEnabled: false,
      })
    ).toBe(false);
  });
});
