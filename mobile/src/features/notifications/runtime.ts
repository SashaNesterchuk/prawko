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

function getReminderCopy(hour: number) {
  const isMorningReminder = hour < 12;
  const preferredLocale = useAppShellStore.getState().preferredLocale;

  return {
    title: isMorningReminder
      ? i18n.t("notification.morningTitle", { lng: preferredLocale })
      : i18n.t("notification.eveningTitle", { lng: preferredLocale }),
    body: isMorningReminder
      ? i18n.t("notification.morningBody", { lng: preferredLocale })
      : i18n.t("notification.eveningBody", { lng: preferredLocale }),
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
  const hours = useAppShellStore.getState().notificationHours;

  return hours.length > 0 ? hours : DEFAULT_NOTIFICATION_HOURS;
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

  for (const hour of hours) {
    const copy = getReminderCopy(hour.hour);
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

  if (
    !store.isScheduleNotificationEnabled &&
    scheduledNotifications.length > 0
  ) {
    store.setScheduledNotificationIds(
      scheduledNotifications.map((item) => item.identifier),
    );
    store.setScheduleNotificationEnabled(true);
    return true;
  }

  if (
    store.isScheduleNotificationEnabled &&
    (store.scheduledNotificationIds.length === 0 ||
      scheduledNotifications.length === 0)
  ) {
    const scheduledNotificationIds = await scheduleStudyNotificationsAsync(
      getActiveNotificationHours(),
    );

    store.setScheduledNotificationIds(scheduledNotificationIds);
    store.setScheduleNotificationEnabled(scheduledNotificationIds.length > 0);
    return scheduledNotificationIds.length > 0;
  }

  return store.isScheduleNotificationEnabled;
}
