import { createExternalEntryObserver, externalLinkTarget, ENTRY_ASSOCIATION_HORIZON_MS } from "../external-entry-observation";
import { createActivityTracker } from "../activity";
import { validateAnalyticsPayload } from "../payload-contract";
import type { AnalyticsProperties } from "../catalog";

function fixture() {
  let time = 0;
  let serial = 0;
  const observer = createExternalEntryObserver({
    now: () => time, wallNow: () => Date.UTC(2026, 9, 7) + time, createId: (prefix) => `${prefix}_${++serial}`,
  });
  const emit = jest.fn();
  observer.setEmitter(emit);
  const context = {
    app_visit_id: "visit_1", app_visibility: "active", route_pattern: "/exam/session",
    route_entity_id: "session_1", view_state: "question",
  };
  return { observer, emit, context, advance: (ms: number) => { time += ms; } };
}

describe("external entry target normalization", () => {
  it("uses the screen tracker's scalar entity precedence instead of conflating unrelated parameters", () => {
    const preferred = externalLinkTarget("prawko://exam/session?sessionId=one&session=two&topicId=three");
    expect(preferred).toEqual(externalLinkTarget("prawko://exam/session?sessionId=one"));
    expect(externalLinkTarget("prawko://topic/three?sessionId=one").entry_target_entity_revision)
      .toBe(preferred.entry_target_entity_revision);
    expect(externalLinkTarget("prawko://exam/session?sessionId=one&sessionId=two&session=next"))
      .toEqual(externalLinkTarget("prawko://exam/session?session=next"));
  });

  it("keeps selected path/query conflicts and rejected identifiers unverified", () => {
    expect(externalLinkTarget("prawko://topic/one?topicId=two").entry_target_basis).toBe("conflicting_entity_ids");
    expect(externalLinkTarget("prawko://topic/one?topicId=one").entry_target_basis).toBe("normalized_entity_id");
    expect(externalLinkTarget("prawko://exam/session?session=private%40example.com").entry_target_basis).toBe("entity_unverified");
    expect(externalLinkTarget("prawko://topic/%XX").entry_target_basis).toBe("malformed_url");
    expect(externalLinkTarget("prawko://nothing/private").entry_target_basis).toBe("unknown_route");
    expect(externalLinkTarget("not a URL").entry_target_basis).toBe("malformed_url");
    expect(externalLinkTarget(`prawko://topic/${"a".repeat(8192)}`).entry_target_basis).toBe("malformed_url");
  });

  it("never exports URLs, query text or entity values", () => {
    const serialized = JSON.stringify(externalLinkTarget("https://private.example/topic/secret-id?token=private-token"));
    expect(serialized).not.toMatch(/private\.example|secret-id|private-token|token=/);
  });
});

describe("external entry observation scope", () => {
  it("distinguishes a preexisting destination, loading, usable partial-error question and entity mismatch", () => {
    const { observer, context, emit } = fixture();
    const entry = observer.receiveLink("prawko://exam/session?session=session_1", "live_url", context);
    observer.observeDestination({ ...context, view_state: "loading" }, "preexisting_route_snapshot");
    observer.observeDestination({ ...context, route_entity_id: "session_2" }, "foreground_view_state");
    observer.observeDestination({ ...context, view_state: "question_with_error" }, "foreground_view_state");
    observer.observeDestination(context, "foreground_view_state");
    const observations = emit.mock.calls.map(([, props]) => props);
    expect(observations).toHaveLength(3);
    expect(observations[0]).toMatchObject({ entry_destination_basis: "preexisting_route_snapshot", entry_destination_phase: "loading" });
    expect(observations[1]).toMatchObject({ entry_destination_match: "different_entity" });
    expect(observations[2]).toMatchObject({ entry_destination_match: "route_and_entity", entry_destination_phase: "usable" });
    for (const [event, props] of emit.mock.calls) {
      expect(validateAnalyticsPayload(event, props).analytics_payload_valid).toBe(true);
    }
    expect(observer.getAssociation("visit_1", "active").entry_observation_id).toBe(entry.entry_observation_id);
    expect(observer.getAssociation("visit_2", "active")).toEqual({});
    expect(observer.getAssociation("visit_1", "inactive")).toEqual({});
  });

  it("binds a cold signal only within the destination horizon and never to a later visit", () => {
    const { observer, context, advance } = fixture();
    const cold = { ...context, app_visibility: "background", app_visit_id: null };
    expect(observer.receiveLink("prawko://learn", "initial_url", cold).entry_scope_status).toBe("awaiting_foreground");
    advance(59_999);
    observer.bindVisit("visit_1");
    expect(observer.getAssociation("visit_1", "active").entry_scope_status).toBe("bound_visit");
    observer.end("observer_unmount");
    observer.receiveLink("prawko://learn", "initial_url", cold);
    advance(60_000);
    observer.bindVisit("visit_2");
    expect(observer.getAssociation("visit_2", "active")).toEqual({});
  });

  it("ends destination at 60 seconds but retains association until the half-open one-hour limit", () => {
    const { observer, context, advance, emit } = fixture();
    observer.receiveLink("prawko://exam/session?session=session_1", "live_url", context);
    advance(60_000);
    observer.observeDestination(context, "foreground_view_state");
    expect(emit.mock.calls.map(([event]) => event)).toEqual(["external_entry_destination_ended"]);
    expect(observer.getAssociation("visit_1", "active").entry_observation_id).toBeTruthy();
    advance(ENTRY_ASSOCIATION_HORIZON_MS - 60_001);
    expect(observer.getAssociation("visit_1", "active").entry_observation_id).toBeTruthy();
    advance(1);
    expect(observer.getAssociation("visit_1", "active")).toEqual({});
    observer.tick();
    expect(emit.mock.calls.at(-1)?.[1].entry_end_reason).toBe("association_horizon_elapsed");
  });

  it("keeps cached responses unattributed without replacing a live association", () => {
    const { observer, context, emit } = fixture();
    const live = observer.receiveNotification("response_1", false, context);
    const cached = observer.receiveNotification("response_2", true, context);
    expect(cached).toMatchObject({ entry_scope_status: "cached_unattributed", entry_bound_app_visit_id: null });
    expect(observer.getAssociation("visit_1", "active").entry_observation_id).toBe(live.entry_observation_id);
    expect(emit).not.toHaveBeenCalled();
    observer.visitEnded("visit_1");
    expect(observer.getAssociation("visit_1", "active")).toEqual({});
  });

  it("matches router group aliases and keeps duplicate live responses on the original horizon", () => {
    const { observer, context, emit, advance } = fixture();
    observer.receiveLink("prawko://learn", "live_url", context);
    observer.observeDestination({ ...context, route_pattern: "/(tabs)/learn" }, "foreground_route_transition");
    expect(emit.mock.calls[0][1].entry_destination_match).toBe("static_route");
    const first = observer.receiveNotification("response", false, context);
    advance(59_000);
    const second = observer.receiveNotification("response", false, context);
    expect(second.entry_observation_id).toBe(first.entry_observation_id);
    expect(second.entry_signal_received_at).toBe(first.entry_signal_received_at);
    advance(1000);
    observer.tick();
    expect(emit.mock.calls.at(-1)?.[1].entry_destination_end_reason).toBe("destination_horizon_elapsed");
  });

  it("does not reattribute a queued response across visits, delayed foreground or failed receipt", () => {
    const { observer, context, advance } = fixture();
    const signal = observer.recordSignal(context);
    const changed = observer.receiveNotification("queued", false, { ...context, app_visit_id: "visit_2" }, signal);
    expect(changed.entry_scope_status).toBe("processing_visit_changed");
    observer.bindVisit("visit_2");
    expect(observer.getAssociation("visit_2", "active")).toEqual({});
    const inactive = observer.recordSignal({ ...context, app_visibility: "background" });
    advance(60_000);
    expect(observer.receiveNotification("late", false, context, inactive).entry_scope_status).toBe("signal_horizon_elapsed");
    expect(observer.receiveNotification("failed", false, context, null)).toEqual({});
    expect(observer.getAssociation("visit_1", "active")).toEqual({});
  });

  it("does not turn an active signal with an invalid visit ID into a cold-start association", () => {
    const { observer, context } = fixture();
    const signal = observer.recordSignal({ ...context, app_visit_id: "learner@example.com" });
    const entry = observer.receiveNotification("unknown-visit", false, context, signal);
    expect(entry.entry_scope_status).toBe("processing_visit_changed");
    observer.bindVisit("visit_1");
    expect(observer.getAssociation("visit_1", "active")).toEqual({});
  });

  it.each(["offline_gate", "missing_result", "checking", "unrecognized"])("classifies destination state %s without exporting it", (state) => {
    const { observer, context, emit } = fixture();
    observer.receiveLink("prawko://exam/session", "live_url", context);
    observer.observeDestination({ ...context, view_state: state }, "foreground_view_state");
    expect(emit.mock.calls[0][1].entry_destination_phase)
      .toBe({ offline_gate: "blocked", missing_result: "error", checking: "loading", unrecognized: "other" }[state]);
    expect(emit.mock.calls[0][1].view_state).toBeUndefined();
  });

  it("contains failed IDs, clocks and capture, with no emitting recursion from context", () => {
    const badId = createExternalEntryObserver({ createId: () => { throw new Error("ID unavailable"); } });
    expect(badId.receiveLink("prawko://learn", "live_url", {})).toEqual({});
    const badClock = createExternalEntryObserver({ now: () => { throw new Error("clock unavailable"); } });
    expect(badClock.recordSignal({})).toBeNull();
    const { observer, context, advance, emit } = fixture();
    observer.receiveLink("prawko://learn", "live_url", context);
    observer.setEmitter(() => { observer.getAssociation("visit_1", "active"); throw new Error("capture"); });
    expect(() => observer.observeDestination(context, "foreground_view_state")).not.toThrow();
    advance(-1);
    expect(() => observer.tick()).not.toThrow();
    expect(observer.getAssociation("visit_1", "active")).toEqual({});
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("activity observer integration", () => {
  it("enriches only the bound foreground visit and ends it on background without changing counters", () => {
    const { observer, advance } = fixture();
    let time = 0;
    let id = 0;
    const activity = createActivityTracker({
      now: () => time, wallNow: () => time, createId: (prefix) => `${prefix}_${++id}`, entryObserver: observer,
    });
    const capture = jest.fn();
    activity.setEmitter(capture);
    activity.setScreen({ route_pattern: "/learn", screen_name: "learn" });
    observer.receiveLink("prawko://learn", "initial_url", activity.getContext());
    activity.observeVisibility("active");
    const bound = activity.getContext() as AnalyticsProperties;
    expect(bound.entry_bound_app_visit_id).toBe(bound.app_visit_id);
    activity.recordInteraction();
    time += 1000;
    advance(1000);
    activity.setViewState({ screen_name: "learn", view_state: "ready" });
    activity.observeVisibility("inactive");
    time += 500;
    advance(500);
    activity.observeVisibility("active");
    activity.observeVisibility("background");
    const terminal = capture.mock.calls.find(([event]) => event === "app_visit_ended")?.[1];
    expect(terminal).toMatchObject({ foreground_ms: 1000, inactive_ms: 500, interaction_engaged_ms: 1000 });
    expect(activity.getContext().entry_observation_id).toBeUndefined();
    activity.observeVisibility("active");
    expect(activity.getContext().entry_observation_id).toBeUndefined();
  });
});
