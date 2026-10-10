import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import i18n from "../../i18n";
import {
  DEFAULT_NOTIFICATION_HOURS,
  type NotificationHour,
  useAppShellStore,
} from "../../state/app-shell";
import { areNotificationsAllowed } from "./permission";
import { analyticsActivity, analyticsMonotonicNow } from "../../analytics/activity";
import { ANALYTICS_EVENTS, getAnalyticsErrorCode } from "../../analytics/catalog";
import { createAnalyticsId } from "../../analytics/runtime-context";
import type { NotificationSchedulePayload } from "../../analytics/operation-payloads";

export { areNotificationsAllowed } from "./permission";

const STUDY_NOTIFICATIONS_CHANNEL_ID = "study-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type EnableStudyNotificationsResult =
  | { ok: true }
  | { ok: false; reason: "permission-denied"; canAskAgain: boolean };

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

function getReminderCopy() {
  const preferredLocale = useAppShellStore.getState().preferredLocale;

  return {
    title: i18n.t("notification.title", { lng: preferredLocale }),
    body: i18n.t("notification.body", { lng: preferredLocale }),
  };
}

async function ensureNotificationChannelAsync() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(
    STUDY_NOTIFICATIONS_CHANNEL_ID,
    {
      name: "Study reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
    },
  );
}

async function maybeStorePushTokenAsync() {
  const projectId = getProjectId();

  if (!projectId) {
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });

    useAppShellStore.getState().setPushNotificationToken(data);
    return data;
  } catch (error) {
    console.warn("Failed to fetch Expo push token.", error);
    return null;
  }
}

function getActiveNotificationHours() {
  return DEFAULT_NOTIFICATION_HOURS;
}

async function cancelAllStudyNotificationsAsync() {
  const store = useAppShellStore.getState();
  const knownIds = store.scheduledNotificationIds;

  if (knownIds.length > 0) {
    await Promise.all(
      knownIds.map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
      ),
    );
  }

  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  store.setScheduledNotificationIds([]);
}

async function scheduleStudyNotificationsAsync(hours: NotificationHour[]) {
  const scheduledNotificationIds: string[] = [];
  const copy = getReminderCopy();

  for (const hour of hours) {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body,
        sound: true,
        data: { analytics_reminder_kind: "study_daily" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hour.hour,
        minute: hour.minute,
        ...(Platform.OS === "android"
          ? { channelId: STUDY_NOTIFICATIONS_CHANNEL_ID }
          : null),
      },
    });

    scheduledNotificationIds.push(identifier);
  }

  return scheduledNotificationIds;
}

async function disableStudyNotificationsImpl() {
  await cancelAllStudyNotificationsAsync();
  useAppShellStore.getState().setScheduleNotificationEnabled(false);
}

async function enableStudyNotificationsImpl(): Promise<EnableStudyNotificationsResult> {
  await ensureNotificationChannelAsync();

  let permission = await Notifications.getPermissionsAsync();

  if (!areNotificationsAllowed(permission)) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (!areNotificationsAllowed(permission)) {
    const store = useAppShellStore.getState();
    store.setScheduleNotificationEnabled(false);
    store.setScheduledNotificationIds([]);
    return {
      ok: false,
      reason: "permission-denied",
      canAskAgain: permission.canAskAgain,
    };
  }

  // Push token is optional for local study reminders and can hang/fail on
  // simulators — never block enabling the toggle on it.
  void maybeStorePushTokenAsync();

  await cancelAllStudyNotificationsAsync();

  const scheduledNotificationIds = await scheduleStudyNotificationsAsync(
    getActiveNotificationHours(),
  );
  const store = useAppShellStore.getState();

  store.setScheduledNotificationIds(scheduledNotificationIds);
  store.setScheduleNotificationEnabled(true);

  return { ok: true };
}

async function syncNotificationStateImpl() {
  await ensureNotificationChannelAsync();

  const permission = await Notifications.getPermissionsAsync();

  if (!areNotificationsAllowed(permission)) {
    const store = useAppShellStore.getState();

    store.setScheduleNotificationEnabled(false);
    store.setScheduledNotificationIds([]);
    return false;
  }

  void maybeStorePushTokenAsync();

  const store = useAppShellStore.getState();
  const scheduledNotifications =
    await Notifications.getAllScheduledNotificationsAsync();
  const shouldKeepEnabled =
    store.isScheduleNotificationEnabled || scheduledNotifications.length > 0;

  if (!shouldKeepEnabled) {
    return false;
  }

  // Refresh daily so locale/copy and the single 19:00 slot stay in sync.
  await cancelAllStudyNotificationsAsync();

  const scheduledNotificationIds = await scheduleStudyNotificationsAsync(
    getActiveNotificationHours(),
  );
  const nextStore = useAppShellStore.getState();

  nextStore.setScheduledNotificationIds(scheduledNotificationIds);
  nextStore.setScheduleNotificationEnabled(true);

  return true;
}

async function observeSchedule<T>(operation: NotificationSchedulePayload["operation"], run: () => Promise<T>): Promise<T> {
  const operationId = createAnalyticsId("notification_schedule");
  const startedAt = analyticsMonotonicNow();
  const previousState = useAppShellStore.getState();
  const wasEnabled = previousState.isScheduleNotificationEnabled;
  const hadScheduledNotifications = previousState.scheduledNotificationIds.length > 0;
  const record = (outcome: NotificationSchedulePayload["outcome"], error?: unknown) => {
    try {
      const state = useAppShellStore.getState();
      // Keep user actions, failures and enabled-to-disabled transitions observable.
      if (operation === "sync" && outcome === "disabled" && !wasEnabled &&
        !hadScheduledNotifications && state.scheduledNotificationIds.length === 0) return;

      analyticsActivity.capture(ANALYTICS_EVENTS.notificationScheduleResolved.key, {
        operation_id: operationId, operation, outcome, reminder_kind: "study_daily",
        request_duration_ms: Math.round(analyticsMonotonicNow() - startedAt),
        scheduled_count: state.scheduledNotificationIds.length,
        enabled: state.isScheduleNotificationEnabled,
        confirmation_scope: "helper_result_not_delivery",
        ...(error ? { error_code: getAnalyticsErrorCode(error) } : {}),
      });
    } catch { /* Observation cannot change the schedule helper outcome. */ }
  };
  try {
    const result = await run();
    record(result && typeof result === "object" && "ok" in result && !result.ok
      ? "permission_denied" : useAppShellStore.getState().isScheduleNotificationEnabled ? "enabled" : "disabled");
    return result;
  } catch (error) {
    record("failed", error);
    throw error;
  }
}

export function disableStudyNotificationsAsync() {
  return observeSchedule("disable", disableStudyNotificationsImpl);
}

export function enableStudyNotificationsAsync(): Promise<EnableStudyNotificationsResult> {
  return observeSchedule("enable", enableStudyNotificationsImpl);
}

export function syncNotificationStateAsync() {
  return observeSchedule("sync", syncNotificationStateImpl);
}
