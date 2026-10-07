import AsyncStorage from "@react-native-async-storage/async-storage";
import { AnalyticsLifecycleObserver } from "../AnalyticsLifecycleObserver";
import { analyticsActivity } from "../activity";
import { externalEntryObservation } from "../external-entry-observation";

const mockTrack = jest.fn();
const mockOpenURL = jest.fn();
let mockEffect: (() => void | (() => void)) | null = null;
let mockCleanup: (() => void) | void;
let mockVisibility = "active";
let mockInitialURL: Promise<string | null> = Promise.resolve(null);
let mockLastResponse: Promise<unknown> = Promise.resolve(null);
let mockLink: ((input: { url: string }) => void) | null = null;
let mockResponse: ((response: unknown) => void) | null = null;
const mockVisibilityListeners = new Set<(state: string) => void>();

jest.mock("react", () => ({
  useRef: (current: unknown) => ({ current }),
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
  Linking: {
    getInitialURL: () => mockInitialURL,
    openURL: (...args: unknown[]) => mockOpenURL(...args),
    addEventListener: (_name: string, listener: typeof mockLink) => {
      mockLink = listener;
      return { remove: () => { mockLink = null; } };
    },
  },
}));
jest.mock("expo-notifications", () => ({
  getLastNotificationResponseAsync: () => mockLastResponse,
  addNotificationResponseReceivedListener: (listener: typeof mockResponse) => {
    mockResponse = listener;
    return { remove: () => { mockResponse = null; } };
  },
}));
jest.mock("../../hooks/useAnalytics", () => ({
  useAnalytics: () => ({ track: mockTrack }),
}));
jest.mock("../external-entry-observation", () => {
  const actual = jest.requireActual("../external-entry-observation");
  return {
    ...actual,
    externalEntryObservation: actual.createExternalEntryObserver({
      now: () => performance.now(), wallNow: () => Date.now(),
    }),
  };
});

function response() {
  return {
    notification: {
      date: 123, request: { identifier: "notification_1", content: { data: { analytics_reminder_kind: "study_daily" } } },
    },
    actionIdentifier: "default",
  };
}
function mount() {
  AnalyticsLifecycleObserver();
  mockCleanup = (mockEffect as (() => void | (() => void)) | null)?.();
}
function visibility(state: string) {
  mockVisibility = state;
  for (const listener of mockVisibilityListeners) listener(state);
}
async function flush() {
  for (let index = 0; index < 25; index++) await Promise.resolve();
}
function events(name: string) {
  return mockTrack.mock.calls.filter(([event]) => event === name).map(([, props]) => props);
}

// Actual lifecycle hook, with controlled OS/storage adapters; not native delivery acceptance.
describe("external entry lifecycle wiring", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-07T10:00:00Z"));
    analyticsActivity.observeVisibility("background");
    externalEntryObservation.end("observer_unmount");
    await AsyncStorage.clear();
    mockTrack.mockReset();
    mockCleanup = undefined;
    mockVisibilityListeners.clear();
    mockVisibility = "active";
    mockInitialURL = Promise.resolve(null);
    mockLastResponse = Promise.resolve(null);
    analyticsActivity.setScreen({ route_pattern: "/learn", screen_name: "learn" });
  });
  afterEach(async () => {
    mockCleanup?.();
    await flush();
    analyticsActivity.observeVisibility("background");
    jest.useRealTimers();
  });

  it("emits a live source before the preexisting destination and does not route", async () => {
    mount();
    await flush();
    mockLink?.({ url: "prawko://learn?token=private" });
    const source = events("app_entry_resolved").find((props) => props.entry_observation_id);
    const destination = events("external_entry_destination_observed")[0];
    expect(source).toMatchObject({ entry_kind: "deep_link", entry_scope_status: "bound_visit" });
    expect(destination).toMatchObject({
      entry_observation_id: source.entry_observation_id, entry_destination_basis: "preexisting_route_snapshot",
      entry_destination_match: "static_route",
    });
    const names = mockTrack.mock.calls.map(([name]) => name);
    expect(names.lastIndexOf("app_entry_resolved")).toBeLessThan(names.indexOf("external_entry_destination_observed"));
    expect(mockOpenURL).not.toHaveBeenCalled();
    expect(JSON.stringify(mockTrack.mock.calls)).not.toContain("token=private");
  });

  it("keeps cached dedupe and permits a later live resolution without a second notification open", async () => {
    mockLastResponse = Promise.resolve(response());
    mount();
    await flush();
    expect(events("notification_opened")).toHaveLength(1);
    expect(events("notification_opened")[0]).toMatchObject({
      cached_response: true, entry_attributed: false, entry_scope_status: "cached_unattributed",
    });
    expect(analyticsActivity.getContext().entry_observation_id).toBeUndefined();
    mockResponse?.(response());
    await flush();
    expect(events("notification_opened")).toHaveLength(1);
    const live = events("app_entry_resolved").find((props) => props.entry_kind === "notification");
    expect(live).toMatchObject({ cached_response: false, entry_scope_status: "bound_visit" });
    expect(analyticsActivity.getContext().entry_observation_id).toBe(live.entry_observation_id);
    expect(JSON.parse((await AsyncStorage.getItem("prawko.analytics.notification-responses.v1"))!))
      .toEqual(["notification_1:123:default"]);
  });

  it("records response receipt before the storage queue and rejects a changed processing visit", async () => {
    let resolveStorage!: (value: string | null) => void;
    jest.spyOn(AsyncStorage, "getItem").mockImplementationOnce(() => new Promise((resolve) => { resolveStorage = resolve; }));
    mount();
    mockResponse?.(response());
    visibility("background");
    jest.advanceTimersByTime(1000);
    visibility("active");
    resolveStorage(null);
    await flush();
    expect(events("notification_opened")[0]).toMatchObject({
      entry_scope_status: "processing_visit_changed", entry_bound_app_visit_id: null,
      entry_signal_received_at: "2026-10-07T10:00:00.000Z", entry_observed_at: "2026-10-07T10:00:01.000Z",
    });
    expect(analyticsActivity.getContext().entry_observation_id).toBeUndefined();
  });

  it("does not promote a much later queued cold response or resolve a late initial URL after a live entry", async () => {
    let resolveStorage!: (value: string | null) => void;
    let resolveURL!: (value: string) => void;
    jest.spyOn(AsyncStorage, "getItem").mockImplementationOnce(() => new Promise((resolve) => { resolveStorage = resolve; }));
    mockInitialURL = new Promise((resolve) => { resolveURL = resolve; });
    mockVisibility = "background";
    mount();
    mockResponse?.(response());
    jest.advanceTimersByTime(60_000);
    visibility("active");
    resolveStorage(null);
    await flush();
    expect(events("notification_opened")[0].entry_scope_status).toBe("signal_horizon_elapsed");
    resolveURL("prawko://learn");
    await flush();
    expect(events("app_entry_resolved").filter((props) => props.entry_kind === "deep_link")).toEqual([]);
    expect(analyticsActivity.getContext().entry_observation_id).toBeUndefined();
  });

  it("contains capture errors and cleans listeners without scheduling or storage-policy changes", async () => {
    mockTrack.mockImplementation(() => { throw new Error("capture unavailable"); });
    expect(mount).not.toThrow();
    await flush();
    expect(() => mockLink?.({ url: "prawko://learn" })).not.toThrow();
    mockResponse?.(response());
    await flush();
    expect(await AsyncStorage.getItem("prawko.analytics.notification-responses.v1")).toBeTruthy();
    expect(() => mockCleanup?.()).not.toThrow();
    mockCleanup = undefined;
    expect(mockLink).toBeNull();
    expect(mockResponse).toBeNull();
    expect(mockVisibilityListeners.size).toBe(0);
  });
});
