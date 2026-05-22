import type { PropsWithChildren, ReactNode } from "react";
import {
  Component,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  type CaptureErrorInput,
  normalizeCapturedError,
  persistMobileErrorLog,
} from "../features/errors/error-logging";
import { useCurrentUser, useAppShellStore } from "../state/app-shell";
import { type AnalyticsTrackPayload, useAnalytics } from "./AnalyticsProvider";

type ErrorLoggingContextValue = {
  captureError: (input: CaptureErrorInput) => void;
  captureFallback: (
    input: Omit<CaptureErrorInput, "severity"> & {
      severity?: "warning" | "error";
    }
  ) => void;
};

const ErrorLoggingContext = createContext<ErrorLoggingContextValue>({
  captureError: () => undefined,
  captureFallback: () => undefined,
});

type ReactNativeGlobalErrorUtils = {
  ErrorUtils?: {
    getGlobalHandler?: () => ((
      error: Error,
      isFatal?: boolean
    ) => void) | undefined;
    setGlobalHandler?: (
      handler: (error: Error, isFatal?: boolean) => void
    ) => void;
  };
};

export function ErrorLoggingProvider({ children }: PropsWithChildren) {
  const { track } = useAnalytics();
  const currentUser = useCurrentUser();
  const authMode = useAppShellStore((state) => state.authMode);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const captureRef = useRef<(input: CaptureErrorInput) => void>(() => undefined);

  const errorLogger = useMemo<ErrorLoggingContextValue>(() => {
    const captureError = (input: CaptureErrorInput) => {
      const normalized = normalizeCapturedError(input, {
        authMode: authMode ?? null,
        category: preferredCategory ?? null,
        locale: preferredLocale ?? null,
      });

      track("app_error_logged", normalized.analyticsPayload);

      if (__DEV__) {
        console.warn(
          "[app_error_logged]",
          normalized.persistedLog.area,
          normalized.persistedLog.eventName,
          normalized.persistedLog.message,
          input.error ?? null
        );
      }

      void persistMobileErrorLog(normalized.persistedLog, {
        canPersist: currentUser?.provider === "supabase",
      });
    };

    return {
      captureError,
      captureFallback: (input) => {
        const normalized = normalizeCapturedError(
          {
            ...input,
            severity: input.severity ?? "warning",
          },
          {
            authMode: authMode ?? null,
            category: preferredCategory ?? null,
            locale: preferredLocale ?? null,
          }
        );

        track("app_fallback_used", {
          ...(normalized.analyticsPayload as AnalyticsTrackPayload),
        });

        if (__DEV__) {
          console.warn(
            "[app_fallback_used]",
            normalized.persistedLog.area,
            normalized.persistedLog.eventName,
            normalized.persistedLog.message
          );
        }

        void persistMobileErrorLog(normalized.persistedLog, {
          canPersist: currentUser?.provider === "supabase",
        });
      },
    };
  }, [
    authMode,
    currentUser?.provider,
    preferredCategory,
    preferredLocale,
    track,
  ]);

  captureRef.current = errorLogger.captureError;

  useEffect(() => {
    const globalTarget = globalThis as typeof globalThis & ReactNativeGlobalErrorUtils;
    const errorUtils = globalTarget.ErrorUtils;

    if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) {
      return;
    }

    const getGlobalHandler = errorUtils.getGlobalHandler;
    const setGlobalHandler = errorUtils.setGlobalHandler;
    const previousHandler = getGlobalHandler();

    setGlobalHandler((error, isFatal) => {
      captureRef.current({
        area: "app_runtime",
        error,
        eventName: isFatal ? "uncaught_js_fatal_error" : "uncaught_js_error",
        message: isFatal
          ? "Unhandled fatal JavaScript error."
          : "Unhandled JavaScript error.",
        metadata: {
          is_fatal: Boolean(isFatal),
        },
        severity: isFatal ? "critical" : "error",
      });

      previousHandler?.(error, isFatal);
    });

    return () => {
      if (previousHandler) {
        setGlobalHandler(previousHandler);
      }
    };
  }, []);

  return (
    <ErrorLoggingContext.Provider value={errorLogger}>
      <RootErrorBoundary
        onError={(error, errorInfo) => {
          errorLogger.captureError({
            area: "app_runtime",
            error,
            eventName: "react_render_boundary_error",
            message: "A React render error reached the root boundary.",
            metadata: {
              component_stack: errorInfo.componentStack ?? null,
            },
            severity: "critical",
          });
        }}
      >
        {children}
      </RootErrorBoundary>
    </ErrorLoggingContext.Provider>
  );
}

export function useErrorLogger() {
  return useContext(ErrorLoggingContext);
}

class RootErrorBoundary extends Component<
  {
    children: ReactNode;
    onError: (error: Error, errorInfo: { componentStack: string }) => void;
  },
  {
    hasError: boolean;
  }
> {
  state = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    this.props.onError(error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.crashContainer}>
        <View style={styles.crashCard}>
          <Text style={styles.crashEyebrow}>Prawko</Text>
          <Text style={styles.crashTitle}>The app hit an unexpected error.</Text>
          <Text style={styles.crashBody}>
            The issue was recorded for review. Try reopening the screen or restarting
            the app.
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false })}
            style={styles.crashButton}
          >
            <Text style={styles.crashButtonLabel}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  crashBody: {
    color: "#4B4035",
    fontSize: 15,
    lineHeight: 22,
  },
  crashButton: {
    alignItems: "center",
    backgroundColor: "#7A3216",
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 20,
  },
  crashButtonLabel: {
    color: "#FFF6EF",
    fontSize: 15,
    fontWeight: "700",
  },
  crashCard: {
    backgroundColor: "rgba(255, 249, 238, 0.96)",
    borderColor: "rgba(38, 30, 18, 0.1)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    maxWidth: 420,
    padding: 24,
    width: "100%",
  },
  crashContainer: {
    alignItems: "center",
    backgroundColor: "#F3EFE7",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  crashEyebrow: {
    color: "#7A3216",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  crashTitle: {
    color: "#1F1D1A",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 30,
  },
});
