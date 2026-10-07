import { createActivityTracker } from "../activity";
import type { AnalyticsEventName, AnalyticsProperties } from "../catalog";
import { validateAnalyticsPayload } from "../payload-contract";

function fixture() {
  let monotonic = 0;
  let wall = 1_000_000;
  let sequence = 0;
  const captured: { event: AnalyticsEventName; properties: AnalyticsProperties }[] = [];
  const activity = createActivityTracker({
    now: () => monotonic, wallNow: () => wall, createId: (prefix) => `${prefix}-${++sequence}`,
  });
  activity.setEmitter((event, properties) => { captured.push({ event, properties }); });
  activity.setScreen({ route_pattern: "/learn", screen_name: "learn" });
  return {
    activity, captured,
    advance(ms: number, wallMs = ms) { monotonic += ms; wall += wallMs; },
    events(event: AnalyticsEventName) { return captured.filter((row) => row.event === event).map((row) => row.properties); },
    assertValid() {
      for (const row of captured) {
        expect({ event: row.event, ...validateAnalyticsPayload(row.event, row.properties) })
          .toMatchObject({ analytics_payload_valid: true, analytics_payload_contract_status: "valid" });
      }
    },
  };
}

// Actual tracker and clocks; not native lifecycle or SDK delivery acceptance.
describe("activity payload producer contracts", () => {
  it("retains cumulative checkpoints, inactive time, idle cutoff and the last screen at background", () => {
    const f = fixture();
    f.activity.observeVisibility("active");
    f.activity.recordInteraction();
    f.advance(30_000);
    f.activity.checkpoint();
    f.advance(40_000);
    f.activity.checkpoint();
    expect(f.events("app_visit_checkpoint")).toEqual([
      expect.objectContaining({ checkpoint_index: 1, foreground_ms: 30_000, interaction_engaged_ms: 30_000 }),
      expect.objectContaining({ checkpoint_index: 2, foreground_ms: 70_000, interaction_engaged_ms: 60_000 }),
    ]);
    f.activity.observeVisibility("inactive");
    f.advance(5_000);
    f.activity.observeVisibility("active");
    f.advance(10_000);
    f.activity.observeVisibility("background");
    expect(f.events("app_visit_ended")).toEqual([expect.objectContaining({
      app_visit_id: "visit-1", last_screen_visit_id: "screen-2", checkpoint_index: 3,
      foreground_ms: 80_000, inactive_ms: 5_000, interaction_engaged_ms: 60_000, wall_duration_ms: 85_000,
      app_visibility: "background", duration_scope: "observed_foreground",
    })]);
    expect(f.events("screen_visit_ended")[0].screen_visit_id).toBe("screen-2");
    f.assertValid();
  });

  it("does not mint a new visit for inactive/resume but does for background/return", () => {
    const f = fixture();
    f.activity.observeVisibility("active");
    f.activity.observeVisibility("inactive");
    f.advance(10);
    f.activity.observeVisibility("active");
    expect(f.events("app_visit_started")).toHaveLength(1);
    f.activity.observeVisibility("background");
    f.activity.observeVisibility("active");
    expect(f.events("app_visit_started")).toEqual([
      expect.objectContaining({ app_visit_id: "visit-1", start_reason: "runtime_start", previous_visibility: "unknown" }),
      expect.objectContaining({ app_visit_id: "visit-3", start_reason: "foreground_resume", previous_visibility: "background" }),
    ]);
    f.assertValid();
  });

  it("keeps state transitions in one screen and route/entity navigation in distinct screen visits", () => {
    const f = fixture();
    f.activity.observeVisibility("active");
    f.activity.setViewState({ screen_name: "learn", view_state: "loading" });
    f.activity.setViewState({ screen_name: "learn", view_state: "loading" });
    f.activity.setViewState({ screen_name: "learn", view_state: "question" });
    expect(f.events("screen_state_viewed")).toHaveLength(2);
    expect(f.events("screen_state_viewed").map((p) => p.screen_visit_id)).toEqual(["screen-2", "screen-2"]);
    f.activity.setScreen({ route_pattern: "/exam/session", screen_name: "exam_session", route_entity_id: "one" });
    f.activity.setScreen({ route_pattern: "/exam/session", screen_name: "exam_session", route_entity_id: "two" });
    expect(f.events("screen_visit_started")).toHaveLength(3);
    expect(f.events("screen_visit_ended").map((p) => p.end_reason)).toEqual(["navigation", "navigation"]);
    f.assertValid();
  });

  it("preserves navigation observed while inactive without forcing foreground", () => {
    const f = fixture();
    f.activity.observeVisibility("active");
    f.activity.observeVisibility("inactive");
    f.activity.setScreen({ route_pattern: "/profile", screen_name: "profile" });
    expect(f.events("screen_visit_started")[1]).toMatchObject({ app_visibility: "inactive", start_reason: "navigation" });
    expect(f.activity.getVisibility()).toBe("inactive");
    f.assertValid();
  });

  it("keeps a visit with no screen and a null last-screen ID representable", () => {
    const captured: { event: AnalyticsEventName; properties: AnalyticsProperties }[] = [];
    const activity = createActivityTracker({ now: () => 0, wallNow: () => 0, createId: () => "visit" });
    activity.setEmitter((event, properties) => { captured.push({ event, properties }); });
    activity.observeVisibility("active");
    activity.observeVisibility("background");
    expect(captured.map((row) => row.event)).toEqual(["app_visit_started", "app_visit_ended"]);
    expect(captured[1].properties.last_screen_visit_id).toBeNull();
    for (const row of captured) expect(validateAnalyticsPayload(row.event, row.properties).analytics_payload_valid).toBe(true);
  });

  it("does not compare wall-clock duration to monotonic foreground duration", () => {
    const f = fixture();
    f.activity.observeVisibility("active");
    f.advance(5_000, -10_000);
    f.activity.checkpoint();
    expect(f.events("app_visit_checkpoint")[0]).toMatchObject({ foreground_ms: 5_000, wall_duration_ms: 0 });
    f.assertValid();
  });

  it("does not invent a terminal for a checkpoint-only unknown tail", () => {
    const f = fixture();
    f.activity.observeVisibility("active");
    f.advance(100);
    f.activity.checkpoint("observer_unmount");
    expect(f.events("app_visit_ended")).toHaveLength(0);
    expect(f.events("app_visit_checkpoint")[0]).toMatchObject({ checkpoint_reason: "observer_unmount" });
    f.assertValid();
  });

  it("contains emitter failures without preventing further lifecycle observations", () => {
    const f = fixture();
    f.activity.setEmitter(() => { throw new Error("optional capture"); });
    expect(() => f.activity.observeVisibility("active")).not.toThrow();
    f.advance(100);
    f.activity.setEmitter((event, properties) => { f.captured.push({ event, properties }); });
    f.activity.observeVisibility("background");
    expect(f.events("app_visit_ended")[0]).toMatchObject({ foreground_ms: 100, app_visit_id: "visit-1" });
    f.assertValid();
  });
});
