import { useOfflineGateAnalytics } from "../../features/offline/useOfflineGateAnalytics";
import { useExamCategoryMismatchAnalytics } from "../../features/exam/useExamCategoryMismatchAnalytics";
import { validateAnalyticsPayload } from "../payload-contract";

const mockTrack = jest.fn();
const mockRefresh = jest.fn();
let mockFocused = true;
let mockSequence = 0;
let mockRefs: { current: unknown }[] = [];
let mockRefIndex = 0;
let mockEffects: (() => void)[] = [];

jest.mock("react", () => ({
  useRef: (initial: unknown) => {
    const index = mockRefIndex++;
    mockRefs[index] ??= { current: initial };
    return mockRefs[index];
  },
  useEffect: (effect: () => void) => { mockEffects.push(effect); },
}));
jest.mock("expo-router/react-navigation", () => ({ useIsFocused: () => mockFocused }));
jest.mock("../../providers/AnalyticsProvider", () => ({ useAnalytics: () => ({ track: mockTrack }) }));
jest.mock("../runtime-context", () => ({
  createAnalyticsId: (prefix: string) => `${prefix}-${++mockSequence}`,
}));

const gate = {
  status: "blocked", reason: "missing_ready_pack", isOnline: false, offlineReady: false,
  downloadedCategory: null, refresh: mockRefresh,
} as const;
const properties = {
  feature: "training", screen_name: "question_training", requested_category: "B",
  mode: "learning", learning_intent_id: "intent-1",
} as const;
const mismatch = {
  examSessionId: "exam-1", currentCategory: "B", sessionCategory: "A1",
  screenName: "exam_result", eligible: true, resolvedReady: false,
} as const;

function render<Output>(hook: () => Output) {
  mockRefIndex = 0;
  mockEffects = [];
  const output = hook();
  for (const effect of mockEffects) effect();
  return output;
}
function offline(changes: Partial<Parameters<typeof useOfflineGateAnalytics>[0]> = {}) {
  return render(() => useOfflineGateAnalytics({ gate, visible: true, properties, ...changes }));
}
function category(changes: Partial<Parameters<typeof useExamCategoryMismatchAnalytics>[0]> = {}) {
  return render(() => useExamCategoryMismatchAnalytics({ ...mismatch, ...changes }));
}
function events(name: string) {
  return mockTrack.mock.calls.filter(([event]) => event === name).map(([, props]) => props);
}

// Executes the production hooks with controlled focus/effect adapters, not native rendering.
describe("learning gate analytics hook wiring", () => {
  beforeEach(() => {
    mockTrack.mockReset();
    mockRefresh.mockReset();
    mockFocused = true;
    mockSequence = 0;
    mockRefs = [];
  });

  afterEach(() => {
    for (const [event, props] of mockTrack.mock.calls) {
      expect(validateAnalyticsPayload(event, props).analytics_payload_valid).toBe(true);
    }
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("only observes a focused visible block and retains one ID and snapshot for its actions", () => {
    offline({ visible: false }).trackAction("close");
    mockFocused = false;
    offline();
    expect(mockTrack).not.toHaveBeenCalled();
    mockFocused = true;
    const block = offline();
    expect(block.getBlockId()).toBe("block-1");
    offline();
    block.trackAction("open_offline_mode", "/offline-mode");
    block.trackAction("close");
    expect(events("learning_access_blocked")).toEqual([{
      ...properties, block_id: "block-1", blocked_reason: "missing_ready_pack",
      is_online: false, offline_ready: false, downloaded_category: null,
    }]);
    expect(events("learning_access_block_action")).toEqual([
      { ...events("learning_access_blocked")[0], action: "open_offline_mode", destination: "/offline-mode" },
      { ...events("learning_access_blocked")[0], action: "close", destination: null },
    ]);
    expect(block.getBlockId()).toBe("block-1");
  });

  it("preserves the old block for retry, then reads the actual new gate and caller context", () => {
    const first = offline();
    first.trackAction("retry");
    expect(first.getBlockId()).toBeUndefined();
    const nextGate = { ...gate, reason: "pack_for_other_category", downloadedCategory: "A1" } as const;
    const nextProperties = { ...properties, feature: "exam", screen_name: "exam_loading", mode: "exam" } as const;
    const second = offline({ gate: nextGate, properties: nextProperties });
    second.trackAction("open_offline_mode", "/offline-mode");
    expect(events("learning_access_block_action")[0]).toMatchObject({
      block_id: "block-1", feature: "training", blocked_reason: "missing_ready_pack", downloaded_category: null,
    });
    expect(events("learning_access_blocked")[1]).toMatchObject({
      ...nextProperties, block_id: "block-2", blocked_reason: "pack_for_other_category", downloaded_category: "A1",
    });
    expect(events("learning_access_block_action")[1]).toMatchObject({ block_id: "block-2", feature: "exam" });
    expect(nextGate).toEqual({ ...gate, reason: "pack_for_other_category", downloadedCategory: "A1" });
    expect(gate.status).toBe("blocked");
  });

  it("clears observation scope on hidden, unfocused, checking or allowed states without fabricating a terminal", () => {
    offline();
    mockFocused = false;
    const hidden = offline();
    hidden.trackAction("retry");
    expect(hidden.getBlockId()).toBeUndefined();
    mockFocused = true;
    offline();
    offline({ visible: false });
    offline();
    offline({ gate: { status: "checking", isOnline: null, offlineReady: false, downloadedCategory: null, refresh: mockRefresh } });
    offline({ gate: { status: "allowed", isOnline: true, offlineReady: false, downloadedCategory: null, refresh: mockRefresh } })
      .trackAction("close");
    expect(events("learning_access_blocked").map((p) => p.block_id)).toEqual(["block-1", "block-2", "block-3"]);
    expect(mockTrack.mock.calls.every(([name]) => name === "learning_access_blocked")).toBe(true);
  });

  it("does not observe a category mismatch until focus, eligibility and session categories are known", () => {
    mockFocused = false;
    category().selectAction("switch_category");
    mockFocused = true;
    category({ eligible: false });
    category({ examSessionId: null });
    category({ sessionCategory: undefined });
    category({ currentCategory: "A1" });
    expect(mockTrack).not.toHaveBeenCalled();
    category();
    category();
    expect(events("exam_category_mismatch_viewed")).toHaveLength(1);
    expect(events("exam_category_mismatch_viewed")[0]).toEqual({
      mismatch_id: "mismatch-1", exam_session_id: "exam-1", screen_name: "exam_result",
      current_category: "B", session_category: "A1",
    });
  });

  it("keeps switch/close as intents and only resolves the original scope when the matching category is ready", () => {
    category().selectAction("switch_category");
    category().selectAction("close");
    expect(events("exam_category_mismatch_action").map((p) => p.action)).toEqual(["switch_category", "close"]);
    expect(events("settings_changed")[0]).toMatchObject({
      mismatch_id: "mismatch-1", previous: "B", value: "A1", setting: "category", source: "exam_category_mismatch",
    });
    category({ currentCategory: "A1" });
    category({ currentCategory: "A1", resolvedReady: true, eligible: false });
    mockFocused = false;
    category({ currentCategory: "A1", resolvedReady: true });
    expect(events("exam_category_mismatch_resolved")).toHaveLength(0);
    mockFocused = true;
    category({ currentCategory: "A1", resolvedReady: true });
    category({ currentCategory: "A1", resolvedReady: true }).selectAction("close");
    expect(events("exam_category_mismatch_resolved")).toEqual([{
      ...events("exam_category_mismatch_viewed")[0], resolved_category: "A1",
    }]);
    expect(events("exam_category_mismatch_action")).toHaveLength(2);
    expect(events("exam_category_mismatch_viewed")).toHaveLength(1);
  });

  it("deduplicates a pending mismatch by session and allocates separate scopes after resolution or session change", () => {
    category();
    category({ currentCategory: "A2", screenName: "exam_answers" });
    expect(events("exam_category_mismatch_viewed")).toHaveLength(1);
    category({ currentCategory: "A1", resolvedReady: true });
    category();
    category({ examSessionId: "exam-2" });
    expect(events("exam_category_mismatch_viewed").map((p) => [p.mismatch_id, p.exam_session_id])).toEqual([
      ["mismatch-1", "exam-1"], ["mismatch-2", "exam-1"], ["mismatch-3", "exam-2"],
    ]);
    expect(events("exam_category_mismatch_resolved")).toHaveLength(1);
    expect(events("exam_category_mismatch_resolved")[0]).toMatchObject({
      current_category: "B", session_category: "A1", resolved_category: "A1", screen_name: "exam_result",
    });
  });
});
