import { useLearningReadyAnalytics } from "../useLearningReadyAnalytics";
import type { AnalyticsProperties } from "../catalog";
import type { LearningReadyContext } from "../activity-payloads";
import { validateAnalyticsPayload } from "../payload-contract";

const mockTrack = jest.fn();
let mockFocused = true;
let mockVisibility = "active";
let mockRefs: { current: unknown }[] = [];
let mockRefIndex = 0;
let mockEffectIndex = 0;
let mockEffects: { deps: readonly unknown[]; cleanup?: (() => void) | void }[] = [];
let mockLayouts: (() => void)[] = [];
let mockPending: (() => void)[] = [];
const mockListeners = new Set<(state: string) => void>();

function mockSchedule(effect: () => void | (() => void), deps: readonly unknown[], layout: boolean) {
  const index = mockEffectIndex++;
  const before = mockEffects[index];
  if (before && before.deps.length === deps.length && deps.every((value, i) => Object.is(value, before.deps[i]))) return;
  const run = () => {
    before?.cleanup?.();
    mockEffects[index] = { deps, cleanup: effect() };
  };
  (layout ? mockLayouts : mockPending).push(run);
}
jest.mock("react", () => ({
  useRef: (initial: unknown) => {
    const index = mockRefIndex++;
    mockRefs[index] ??= { current: initial };
    return mockRefs[index];
  },
  useLayoutEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => mockSchedule(effect, deps, true),
  useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => mockSchedule(effect, deps, false),
}));
jest.mock("react-native", () => ({
  AppState: {
    get currentState() { return mockVisibility; },
    addEventListener: (_name: string, listener: (state: string) => void) => {
      mockListeners.add(listener);
      return { remove: () => mockListeners.delete(listener) };
    },
  },
}));
jest.mock("expo-router/react-navigation", () => ({ useIsFocused: () => mockFocused }));
jest.mock("../../hooks/useAnalytics", () => ({ useAnalytics: () => ({ track: mockTrack }) }));

const training: AnalyticsProperties & LearningReadyContext = {
  feature: "training", training_session_id: "training-1", question_id: "q-1",
};
function render(ready: boolean, key = "training-1", p = training) {
  mockRefIndex = 0;
  mockEffectIndex = 0;
  mockLayouts = [];
  mockPending = [];
  useLearningReadyAnalytics(key, ready, p);
  for (const run of mockLayouts) run();
  for (const run of mockPending) run();
}
function visibility(next: string) {
  mockVisibility = next;
  for (const listener of mockListeners) listener(next);
}
function payloads() { return mockTrack.mock.calls.map(([, p]) => p); }

// Actual readiness/duration hooks and clock, with controlled React/AppState adapters.
describe("learning readiness producer contract", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockTrack.mockReset();
    mockFocused = true;
    mockVisibility = "active";
    mockRefs = [];
    mockEffects = [];
    mockListeners.clear();
  });
  afterEach(() => {
    for (const effect of mockEffects) effect.cleanup?.();
    expect(mockListeners.size).toBe(0);
    jest.useRealTimers();
  });

  it("measures pending-to-usable focus latency once without implying media readiness", () => {
    render(false);
    jest.advanceTimersByTime(50);
    render(true);
    render(true);
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("learning_screen_ready", {
      ...training, ready_foreground_ms: 50, ready_wall_ms: 50, ready_reason: "focused_ready",
      ready_duration_scope: "current_focus_entry", media_readiness: "not_measured",
    });
    expect(validateAnalyticsPayload("learning_screen_ready", payloads()[0]).analytics_payload_valid).toBe(true);
  });

  it("requires focus and active visibility, preserves inactive dedupe and observes background returns", () => {
    mockFocused = false;
    render(true);
    expect(mockTrack).not.toHaveBeenCalled();
    mockFocused = true;
    render(true);
    visibility("inactive");
    jest.advanceTimersByTime(50);
    visibility("active");
    expect(mockTrack).toHaveBeenCalledTimes(1);
    visibility("background");
    jest.advanceTimersByTime(1000);
    visibility("active");
    expect(payloads()[1]).toMatchObject({
      ready_foreground_ms: 0, ready_wall_ms: 0,
      ready_reason: "foreground_return", ready_duration_scope: "foreground_observation",
    });
    expect(validateAnalyticsPayload("learning_screen_ready", payloads()[1]).analytics_payload_valid).toBe(true);
  });

  it("preserves the existing pending-readiness clock reset on inactive-to-active return", () => {
    render(false);
    jest.advanceTimersByTime(10);
    visibility("inactive");
    jest.advanceTimersByTime(40);
    visibility("active");
    jest.advanceTimersByTime(20);
    render(true);
    expect(payloads()[0]).toMatchObject({
      ready_foreground_ms: 20, ready_wall_ms: 20, ready_reason: "focused_ready",
      ready_duration_scope: "current_focus_entry",
    });
    expect(validateAnalyticsPayload("learning_screen_ready", payloads()[0]).analytics_payload_valid).toBe(true);
  });

  it.each([
    { feature: "training", training_session_id: "t", question_id: "q" },
    { feature: "exam", exam_session_id: "e", question_id: "q" },
    { feature: "sign_test", sign_test_session_id: "s", question_id: "q" },
    { feature: "sign_practice", sign_test_session_id: "s", question_id: "q" },
  ] as const)("keeps the actual $feature session context", (p) => {
    render(true, "session", p);
    expect(payloads()[0]).toMatchObject(p);
    expect(validateAnalyticsPayload("learning_screen_ready", payloads()[0]).analytics_payload_valid).toBe(true);
  });

  it("captures nullable operational metadata as invalid evidence without guarding readiness", () => {
    expect(() => render(true, "training", { ...training, training_session_id: null, question_id: null })).not.toThrow();
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(validateAnalyticsPayload("learning_screen_ready", payloads()[0]).analytics_payload_valid).toBe(false);
  });
});
