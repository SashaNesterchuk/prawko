import { PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";

import { AdProvider } from "../features/ads/AdProvider";
import { AppResumeAdListener } from "../features/ads/AppResumeAdListener";
import "../i18n";
import { useResponsiveStyles } from "../portable-ui";
import { AnalyticsProvider } from "./AnalyticsProvider";
import { ErrorLoggingProvider } from "./ErrorLoggingProvider";
import { LocaleSyncProvider } from "./LocaleSyncProvider";
import { QuestionCatalogProvider } from "./QuestionCatalogProvider";
import { RevenueCatProvider } from "./RevenueCatProvider";
import { RemoteEntitlementsProvider } from "./RemoteEntitlementsProvider";
import { RemoteLearningStateProvider } from "./RemoteLearningStateProvider";
import { SessionProvider } from "./SessionProvider";
import { ThemeProvider } from "./ThemeProvider";
import { UserProvider } from "./UserProvider";

export function AppProviders({ children }: PropsWithChildren) {
  const styles = useStyles();

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AnalyticsProvider>
            <ErrorLoggingProvider>
              <SessionProvider>
                <RemoteEntitlementsProvider>
                  <RevenueCatProvider>
                    <RemoteLearningStateProvider>
                      <LocaleSyncProvider>
                        <UserProvider>
                          <QuestionCatalogProvider>
                            <AdProvider>
                              <AppResumeAdListener />
                              {children}
                              <Toast />
                            </AdProvider>
                          </QuestionCatalogProvider>
                        </UserProvider>
                      </LocaleSyncProvider>
                    </RemoteLearningStateProvider>
                  </RevenueCatProvider>
                </RemoteEntitlementsProvider>
              </SessionProvider>
            </ErrorLoggingProvider>
          </AnalyticsProvider>
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
