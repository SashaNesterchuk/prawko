import { createAnalyticsId, nextAnalyticsEventContext } from "../runtime-context";

describe("analytics runtime context", () => {
  it("uses one run ID and monotonic sequence across capture calls", () => {
    const first = nextAnalyticsEventContext();
    const second = nextAnalyticsEventContext();
    expect(first.app_run_id).toBe(second.app_run_id);
    expect(second.event_sequence).toBe((first.event_sequence as number) + 1);
    expect(second.event_id).toBe(`${second.app_run_id}:${second.event_sequence}`);
    expect(first.event_id).not.toBe(second.event_id);
    expect(second.analytics_schema_version).toBe(3);
    expect(Number.isNaN(Date.parse(second.client_occurred_at as string))).toBe(false);
  });

  it("creates opaque operation IDs without install identity or storage", () => {
    expect(createAnalyticsId("review")).toMatch(
      /^review_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});
