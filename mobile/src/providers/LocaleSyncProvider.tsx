import { PropsWithChildren, useEffect } from "react";

import i18n from "../i18n";
import { useAppShellStore } from "../state/app-shell";

export function LocaleSyncProvider({ children }: PropsWithChildren) {
  const hasHydrated = useAppShellStore((state) => state.hasHydrated);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);

  useEffect(() => {
    if (!hasHydrated || i18n.language === preferredLocale) {
      return;
    }

    void i18n.changeLanguage(preferredLocale);
  }, [hasHydrated, preferredLocale]);

  return children;
}
