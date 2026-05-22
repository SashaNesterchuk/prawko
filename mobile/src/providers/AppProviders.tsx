import { PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";

import "../i18n";
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
                            {children}
                            <Toast />
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
