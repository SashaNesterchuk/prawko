import { PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { AdProvider } from "../features/ads/AdProvider";
import "../i18n";
import { useResponsiveStyles } from "../portable-ui";
import { AnalyticsProvider } from "./AnalyticsProvider";
import { ErrorLoggingProvider } from "./ErrorLoggingProvider";
import { LocaleSyncProvider } from "./LocaleSyncProvider";
import { ExamCountryBootstrap } from "../countries/ExamCountryBootstrap";
import { CountryScopedStores } from "../countries/CountryScopedStores";
import { AppIdentityProvider } from "../identity/AppIdentityProvider";
import { NotificationSetupProvider } from "./NotificationSetupProvider";
import { ObserveIdentitySync } from "./ObserveIdentitySync";
import { QuestionCatalogProvider } from "./QuestionCatalogProvider";
import { RevenueCatProvider } from "./RevenueCatProvider";
import { RemoteEntitlementsProvider } from "./RemoteEntitlementsProvider";
import { RemoteLearningStateProvider } from "./RemoteLearningStateProvider";
import { SessionProvider } from "./SessionProvider";
import { ThemeProvider } from "./ThemeProvider";
import { UserProvider } from "./UserProvider";

export function AppProviders({
  appUserId,
  children,
}: PropsWithChildren<{ appUserId: string }>) {
  const styles = useStyles();

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <BottomSheetModalProvider>
            <AppIdentityProvider appUserId={appUserId}>
              <ObserveIdentitySync />
              <AnalyticsProvider>
                <ErrorLoggingProvider>
                  <SessionProvider>
                    <RemoteEntitlementsProvider>
                      <RevenueCatProvider>
                        <RemoteLearningStateProvider>
                          <NotificationSetupProvider>
                            <ExamCountryBootstrap>
                              <CountryScopedStores>
                                <LocaleSyncProvider>
                                  <UserProvider>
                                    <QuestionCatalogProvider>
                                      <AdProvider>{children}</AdProvider>
                                    </QuestionCatalogProvider>
                                  </UserProvider>
                                </LocaleSyncProvider>
                              </CountryScopedStores>
                            </ExamCountryBootstrap>
                          </NotificationSetupProvider>
                        </RemoteLearningStateProvider>
                      </RevenueCatProvider>
                    </RemoteEntitlementsProvider>
                  </SessionProvider>
                </ErrorLoggingProvider>
              </AnalyticsProvider>
            </AppIdentityProvider>
          </BottomSheetModalProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function useStyles() {
  return useResponsiveStyles(() => ({
    root: {
      flex: 1,
    },
  }));
}
