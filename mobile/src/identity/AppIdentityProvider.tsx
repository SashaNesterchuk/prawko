import { createContext, useContext, type PropsWithChildren } from "react";

const AppIdentityContext = createContext<string | null>(null);

export function AppIdentityProvider({
  appUserId,
  children,
}: PropsWithChildren<{ appUserId: string }>) {
  return (
    <AppIdentityContext.Provider value={appUserId}>
      {children}
    </AppIdentityContext.Provider>
  );
}

export function useAppUserId() {
  const appUserId = useContext(AppIdentityContext);

  if (!appUserId) {
    throw new Error("useAppUserId must be used inside AppIdentityProvider.");
  }

  return appUserId;
}
