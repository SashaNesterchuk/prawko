import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import i18n from "../../i18n";
import {
  DEFAULT_NOTIFICATION_HOURS,
  type NotificationHour,
  useAppShellStore,
} from "../../state/app-shell";

const STUDY_NOTIFICATIONS_CHANNEL_ID = "study-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hour.hour,
        minute: hour.minute,
      },
    });

    scheduledNotificationIds.push(identifier);
  }

  return scheduledNotificationIds;
}

export async function disableStudyNotificationsAsync() {
  await cancelAllStudyNotificationsAsync();
  useAppShellStore.getState().setScheduleNotificationEnabled(false);
}

export async function enableStudyNotificationsAsync() {
  await ensureNotificationChannelAsync();

  let permission = await Notifications.getPermissionsAsync();

  if (permission.status !== "granted") {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (permission.status !== "granted") {
    const store = useAppShellStore.getState();
    store.setScheduleNotificationEnabled(false);
    store.setScheduledNotificationIds([]);
    return false;
  }

  await maybeStorePushTokenAsync();
  await cancelAllStudyNotificationsAsync();

  const scheduledNotificationIds = await scheduleStudyNotificationsAsync(
    getActiveNotificationHours(),
  );
  const store = useAppShellStore.getState();

  store.setScheduledNotificationIds(scheduledNotificationIds);
  store.setScheduleNotificationEnabled(scheduledNotificationIds.length > 0);

  return scheduledNotificationIds.length > 0;
}

export async function syncNotificationStateAsync() {
  await ensureNotificationChannelAsync();

  const permission = await Notifications.getPermissionsAsync();

  if (permission.status !== "granted") {
    const store = useAppShellStore.getState();

    store.setScheduleNotificationEnabled(false);
    store.setScheduledNotificationIds([]);
    return false;
  }

  await maybeStorePushTokenAsync();

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
  nextStore.setScheduleNotificationEnabled(scheduledNotificationIds.length > 0);

  return scheduledNotificationIds.length > 0;
}
