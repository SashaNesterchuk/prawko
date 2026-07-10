import { PropsWithChildren, useEffect } from "react";
import { AppState } from "react-native";

import { syncNotificationStateAsync } from "../features/notifications/runtime";
import { useAppShellStore } from "../state/app-shell";

export function NotificationSetupProvider({ children }: PropsWithChildren) {
  const hasHydrated = useAppShellStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    void syncNotificationStateAsync();
  }, [hasHydrated]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && useAppShellStore.getState().hasHydrated) {
        void syncNotificationStateAsync();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return children;
}
