export type NotificationPermissionSnapshot = {
  granted: boolean;
  status: string;
  ios?: {
    status?: number;
  } | null;
};

/** Matches expo-notifications IosAuthorizationStatus.PROVISIONAL */
export const IOS_PROVISIONAL_AUTHORIZATION_STATUS = 3;

export function areNotificationsAllowed(
  permission: NotificationPermissionSnapshot,
) {
  return (
    permission.granted ||
    permission.status === "granted" ||
    permission.ios?.status === IOS_PROVISIONAL_AUTHORIZATION_STATUS
  );
}
