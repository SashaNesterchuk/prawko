import AsyncStorage from "@react-native-async-storage/async-storage";

import { AnalyticsScreenTracker } from "../AnalyticsScreenTracker";
import { ANALYTICS_EVENTS } from "../catalog";
import { onboardingObservation, observeAcceptedOnboardingCompletion } from "../onboarding-observation";
import { markAnalyticsProgressReset } from "../onboarding-context";
import { validateAnalyticsPayload } from "../payload-contract";

const mockTrack = jest.fn();
const mockSetScreen = jest.fn();
let mockIdentity = "";
let mockSegments: string[] = [];
let mockShell = { hasHydrated: true, onboardingCompleted: false };
let mockRefs: { current: unknown }[] = [];
let mockRefIndex = 0;
let mockEffect: (() => void | (() => void)) | null = null;
let mockCleanup: (() => void) | void;
let mockVisibility = "active";
const mockVisibilityListeners = new Set<(state: string) => void>();

jest.mock("react", () => ({
  useRef: (initial: unknown) => {
    const index = mockRefIndex++;
    mockRefs[index] ??= { current: initial };
    return mockRefs[index];
  },
  useLayoutEffect: (effect: () => void | (() => void)) => { mockEffect = effect; },
}));
jest.mock("react-native", () => ({
  AppState: {
    get currentState() { return mockVisibility; },
    addEventListener: (_name: string, listener: (state: string) => void) => {
      mockVisibilityListeners.add(listener);
      return { remove: () => mockVisibilityListeners.delete(listener) };
    },
  },
}));
jest.mock("expo-router", () => ({
  useSegments: () => mockSegments,
  useGlobalSearchParams: () => ({}),
}));
jest.mock("../../providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: mockTrack }),
}));
jest.mock("../../identity/AppIdentityProvider", () => ({
  useAppUserId: () => mockIdentity,
}));
jest.mock("../../state/app-shell", () => ({
  useAppShellStore: (selector: (state: typeof mockShell) => unknown) => selector(mockShell),
}));
jest.mock("../activity", () => ({
  analyticsActivity: { setScreen: (...args: unknown[]) => mockSetScreen(...args) },
}));

function observeRoute() {
  mockCleanup?.();
  mockRefIndex = 0;
  mockEffect = null;
  AnalyticsScreenTracker();
  const effect = mockEffect as (() => void | (() => void)) | null;
  mockCleanup = effect?.();
}

async function flush() {
  await onboardingObservation.resolve(mockIdentity);
  await Promise.resolve();
}

function events(key: string) {
  return mockTrack.mock.calls.filter(([name]) => name === key).map(([, payload]) => payload);
}

// Exercise the actual hook wiring with controlled route/effect/native adapters.
// This is not a rendered native navigation or delivery acceptance test.
describe("onboarding screen tracker wiring", () => {
  let identityIndex = 0;
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockIdentity = `usr_screen_test_${++identityIndex}`;
    mockSegments = ["(onboarding)", "category"];
    mockShell = { hasHydrated: true, onboardingCompleted: false };
    mockRefs = [];
    mockRefIndex = 0;
    mockCleanup = undefined;
    mockVisibility = "active";
    mockVisibilityListeners.clear();
  });
  afterEach(async () => {
    mockCleanup?.();
    await flush();
    for (const payload of events("screen_viewed")) {
      expect(payload.screen_observation_scope).toBe("route");
      expect(validateAnalyticsPayload("screen_viewed", payload).analytics_payload_valid).toBe(true);
    }
  });

  it("keeps one persisted attempt through steps, accepted completion and foreground Home", async () => {
    observeRoute();
    await flush();
    mockSegments = ["(onboarding)", "exam-schedule"];
    observeRoute();
    await flush();
    const views = events(ANALYTICS_EVENTS.onboardingFlowViewed.key);
    expect(views).toHaveLength(1);
    observeAcceptedOnboardingCompletion(mockTrack, null);
    mockShell.onboardingCompleted = true;
    mockSegments = ["(tabs)"];
    observeRoute();
    await flush();
    const completions = events(ANALYTICS_EVENTS.onboardingFlowCompleted.key);
    const homes = events(ANALYTICS_EVENTS.onboardingHomeArrived.key);
    expect(completions).toHaveLength(1);
    expect(homes).toHaveLength(1);
    expect(homes[0]).toMatchObject({
      onboarding_attempt_id: views[0].onboarding_attempt_id,
      onboarding_completed_at: completions[0].onboarding_completed_at,
      home_arrival_basis: "foreground_route_observed",
    });
    expect(mockSetScreen).toHaveBeenCalledWith(expect.objectContaining({
      screen_name: "home", flow_context: "product", onboarding_attempt_id: null,
    }));
  });

  it("does not turn settings or an existing Home visit into a first-run flow", async () => {
    mockShell.onboardingCompleted = true;
    observeRoute();
    await flush();
    mockSegments = ["(tabs)"];
    observeRoute();
    await flush();
    expect(events(ANALYTICS_EVENTS.onboardingFlowViewed.key)).toEqual([]);
    expect(events(ANALYTICS_EVENTS.onboardingHomeArrived.key)).toEqual([]);
    expect(onboardingObservation.peek(mockIdentity)).toBeNull();
  });

  it("waits for foreground rather than calling a background Home route an arrival", async () => {
    observeRoute();
    await flush();
    observeAcceptedOnboardingCompletion(mockTrack, null);
    mockShell.onboardingCompleted = true;
    mockSegments = ["(tabs)"];
    mockVisibility = "background";
    observeRoute();
    await flush();
    expect(events(ANALYTICS_EVENTS.onboardingHomeArrived.key)).toEqual([]);
    mockVisibility = "active";
    for (const listener of mockVisibilityListeners) listener("active");
    await flush();
    expect(events(ANALYTICS_EVENTS.onboardingHomeArrived.key)).toHaveLength(1);
    for (const listener of mockVisibilityListeners) listener("active");
    await flush();
    expect(events(ANALYTICS_EVENTS.onboardingHomeArrived.key)).toHaveLength(1);
  });

  it("starts a new analytics attempt after reset without changing install identity", async () => {
    observeRoute();
    await flush();
    const original = events(ANALYTICS_EVENTS.onboardingFlowViewed.key)[0].onboarding_attempt_id;
    observeAcceptedOnboardingCompletion(mockTrack, null);
    await flush();
    mockShell.onboardingCompleted = true;
    mockSegments = ["(tabs)"];
    observeRoute();
    await flush();
    markAnalyticsProgressReset("reset_screen_test");
    mockShell.onboardingCompleted = false;
    mockSegments = ["(onboarding)", "category"];
    observeRoute();
    await flush();
    const reset = events(ANALYTICS_EVENTS.onboardingFlowViewed.key)[1];
    expect(reset.onboarding_attempt_id).not.toBe(original);
    expect(reset.start_reason).toBe("progress_reset");
    expect(reset.reset_operation_id).toBe("reset_screen_test");
    expect(onboardingObservation.peek(mockIdentity)?.attemptId).toBe(reset.onboarding_attempt_id);
  });
});
