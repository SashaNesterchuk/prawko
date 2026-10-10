import * as Notifications from "expo-notifications";
import {
  disableStudyNotificationsAsync, enableStudyNotificationsAsync, syncNotificationStateAsync,
} from "../runtime";
import { validateAnalyticsPayload } from "../../../analytics/payload-contract";

const mockCapture = jest.fn();
let mockNow = 0;
let mockSequence = 0;
let mockOs = "ios";
let mockProjectId: string | null = null;
const mockStore = {
  preferredLocale: "cs",
  isScheduleNotificationEnabled: false,
  scheduledNotificationIds: [] as string[],
  setScheduleNotificationEnabled: jest.fn((enabled: boolean) => { mockStore.isScheduleNotificationEnabled = enabled; }),
  setScheduledNotificationIds: jest.fn((ids: string[]) => { mockStore.scheduledNotificationIds = ids; }),
  setPushNotificationToken: jest.fn(),
};

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: "daily" },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { get expoConfig() { return { extra: { eas: { projectId: mockProjectId } } }; } },
}));
jest.mock("react-native", () => ({ Platform: { get OS() { return mockOs; } } }));
jest.mock("../../../i18n", () => ({
  __esModule: true, default: { t: (key: string, options: { lng: string }) => `${options.lng}:${key}` },
}));
jest.mock("../../../state/app-shell", () => ({
  DEFAULT_NOTIFICATION_HOURS: [{ hour: 19, minute: 0 }],
  useAppShellStore: { getState: () => mockStore },
}));
jest.mock("../../../analytics/activity", () => ({
  analyticsActivity: { capture: (...args: unknown[]) => mockCapture(...args) },
  analyticsMonotonicNow: () => mockNow,
}));
jest.mock("../../../analytics/runtime-context", () => ({
  createAnalyticsId: (prefix: string) => `${prefix}-${++mockSequence}`,
}));

const granted = { granted: true, status: "granted", canAskAgain: true };
const denied = { granted: false, status: "denied", canAskAgain: false };
function observation() {
  expect(mockCapture).toHaveBeenCalledTimes(1);
  const [event, p] = mockCapture.mock.calls[0];
  expect(event).toBe("notification_schedule_resolved");
  expect(validateAnalyticsPayload(event, p)).toMatchObject({
    analytics_payload_contract_status: "valid", analytics_payload_valid: true,
  });
  return p;
}

// Actual scheduler wrappers with controlled native/store adapters, not OS delivery acceptance.
describe("notification schedule analytics producer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCapture.mockReset();
    mockNow = 0;
    mockSequence = 0;
    mockOs = "ios";
    mockProjectId = null;
    mockStore.isScheduleNotificationEnabled = false;
    mockStore.scheduledNotificationIds = [];
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(granted as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(denied as never);
    jest.mocked(Notifications.setNotificationChannelAsync).mockResolvedValue(null);
    jest.mocked(Notifications.cancelScheduledNotificationAsync).mockResolvedValue(undefined);
    jest.mocked(Notifications.cancelAllScheduledNotificationsAsync).mockResolvedValue(undefined);
    jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([]);
    jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ data: "private-token" } as never);
    jest.mocked(Notifications.scheduleNotificationAsync).mockImplementation(async () => {
      mockNow += 5;
      return "daily-1";
    });
  });

  it("enables the existing 19:00 schedule and locale copy without extra permission/native calls", async () => {
    mockStore.scheduledNotificationIds = ["old-1"];
    await expect(enableStudyNotificationsAsync()).resolves.toEqual({ ok: true });
    expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("old-1");
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: "cs:notification.title", body: "cs:notification.body", sound: true,
        data: { analytics_reminder_kind: "study_daily" } },
      trigger: { type: "daily", hour: 19, minute: 0 },
    });
    expect(observation()).toMatchObject({
      operation_id: "notification_schedule-1", operation: "enable", outcome: "enabled",
      request_duration_ms: 5, scheduled_count: 1, enabled: true, confirmation_scope: "helper_result_not_delivery",
    });
  });

  it("preserves denied permission return and clears only the existing local state", async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(denied as never);
    mockStore.scheduledNotificationIds = ["old-1"];
    await expect(enableStudyNotificationsAsync()).resolves.toEqual({
      ok: false, reason: "permission-denied", canAskAgain: false,
    });
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(observation()).toMatchObject({ operation: "enable", outcome: "permission_denied", enabled: false, scheduled_count: 0 });
  });

  it("requests once when needed and retains granted and provisional permissions", async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(denied as never);
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(granted as never);
    await expect(enableStudyNotificationsAsync()).resolves.toEqual({ ok: true });
    observation();
    mockCapture.mockClear();
    jest.mocked(Notifications.requestPermissionsAsync).mockClear();
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
      granted: false, status: "undetermined", canAskAgain: true, ios: { status: 3 },
    } as never);
    await expect(enableStudyNotificationsAsync()).resolves.toEqual({ ok: true });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(observation().outcome).toBe("enabled");
  });

  it("rethrows the same native failure and captures only its normalized error", async () => {
    const error = Object.assign(new Error("private native message"), { code: "network" });
    jest.mocked(Notifications.scheduleNotificationAsync).mockRejectedValue(error);
    await expect(enableStudyNotificationsAsync()).rejects.toBe(error);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(observation()).toMatchObject({ operation: "enable", outcome: "failed", error_code: "network", enabled: false });
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain("private native message");
  });

  it.each([null, undefined, 0, false])("retains a falsy native rejection (%s) as invalid diagnostic evidence", async (error) => {
    jest.mocked(Notifications.scheduleNotificationAsync).mockRejectedValue(error);
    await expect(enableStudyNotificationsAsync()).rejects.toBe(error);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    const [event, p] = mockCapture.mock.calls[0];
    expect(p.outcome).toBe("failed");
    expect(p).not.toHaveProperty("error_code");
    expect(validateAnalyticsPayload(event, p).analytics_payload_valid).toBe(false);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it("keeps best-effort cancellation failures separate from helper-resolved local disable", async () => {
    mockStore.isScheduleNotificationEnabled = true;
    mockStore.scheduledNotificationIds = ["old-1"];
    jest.mocked(Notifications.cancelScheduledNotificationAsync).mockRejectedValue(new Error("cancel failed"));
    jest.mocked(Notifications.cancelAllScheduledNotificationsAsync).mockRejectedValue(new Error("cancel all failed"));
    await expect(disableStudyNotificationsAsync()).resolves.toBeUndefined();
    expect(mockStore.scheduledNotificationIds).toEqual([]);
    expect(observation()).toMatchObject({ operation: "disable", outcome: "disabled", scheduled_count: 0, enabled: false });
    expect(observation()).not.toHaveProperty("error_code");
  });

  it.each([granted, denied])("silently checks an already-disabled empty schedule (%j)", async (permission) => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permission as never);
    for (let i = 0; i < 3; i++) {
      await expect(syncNotificationStateAsync()).resolves.toBe(false);
    }
    expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(3);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("still observes an explicit disable when the schedule is already off", async () => {
    await expect(disableStudyNotificationsAsync()).resolves.toBeUndefined();
    expect(observation()).toMatchObject({ operation: "disable", outcome: "disabled", enabled: false });
  });

  it("still observes a failed check when the schedule was already disabled", async () => {
    const error = { code: "permission_read_failed" };
    jest.mocked(Notifications.getPermissionsAsync).mockRejectedValue(error);
    await expect(syncNotificationStateAsync()).rejects.toBe(error);
    expect(observation()).toMatchObject({ operation: "sync", outcome: "failed", error_code: "permission_read_failed" });
  });

  it("does not claim a permission-denied enable flow when sync returns disabled", async () => {
    mockStore.isScheduleNotificationEnabled = true;
    mockStore.scheduledNotificationIds = ["old-1"];
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(denied as never);
    await expect(syncNotificationStateAsync()).resolves.toBe(false);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(observation()).toMatchObject({ operation: "sync", outcome: "disabled", scheduled_count: 0, enabled: false });
  });

  it("keeps stale local IDs representable when an allowed but disabled sync does not refresh", async () => {
    mockStore.scheduledNotificationIds = ["stale-1"];
    await expect(syncNotificationStateAsync()).resolves.toBe(false);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(observation()).toMatchObject({ operation: "sync", outcome: "disabled", scheduled_count: 1, enabled: false });
  });

  it("retains sync refresh when the OS reports an existing schedule", async () => {
    jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([{ identifier: "os-1" }] as never);
    await expect(syncNotificationStateAsync()).resolves.toBe(true);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(observation()).toMatchObject({ operation: "sync", outcome: "enabled", scheduled_count: 1, enabled: true });
  });

  it("does not clear an existing enabled state when an Android channel call rejects", async () => {
    mockOs = "android";
    mockStore.isScheduleNotificationEnabled = true;
    mockStore.scheduledNotificationIds = ["old-1"];
    const error = { code: "channel_error" };
    jest.mocked(Notifications.setNotificationChannelAsync).mockRejectedValue(error);
    await expect(syncNotificationStateAsync()).rejects.toBe(error);
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(observation()).toMatchObject({ operation: "sync", outcome: "failed", enabled: true, scheduled_count: 1, error_code: "channel_error" });
  });

  it("does not wait for the optional push token or expose it in the observation", async () => {
    mockProjectId = "project-1";
    jest.mocked(Notifications.getExpoPushTokenAsync).mockImplementation(() => new Promise(() => undefined));
    await expect(enableStudyNotificationsAsync()).resolves.toEqual({ ok: true });
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
    observation();
    expect(JSON.stringify(mockCapture.mock.calls)).not.toContain("private-token");
  });

  it("contains capture failure without changing the result, state or scheduling call count", async () => {
    mockCapture.mockImplementation(() => { throw new Error("optional capture"); });
    await expect(enableStudyNotificationsAsync()).resolves.toEqual({ ok: true });
    expect(mockStore.isScheduleNotificationEnabled).toBe(true);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});
