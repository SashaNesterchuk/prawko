import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useRef } from "react";

import { PostHog } from "posthog-react-native";

import { mobileEnv } from "../config/env";
import { useCurrentUser, useAppShellStore } from "../state/app-shell";

export type AnalyticsTrackPayload = Record<string, string | number | boolean | null>;

type AnalyticsContextValue = {
  identify: (distinctId: string, payload?: AnalyticsTrackPayload) => void;
  isConfigured: boolean;
  reset: () => void;
  screen: (name: string, payload?: AnalyticsTrackPayload) => void;
  track: (event: string, payload?: AnalyticsTrackPayload) => void;
};

const AnalyticsContext = createContext<AnalyticsContextValue>({
  identify: () => undefined,
  isConfigured: false,
  reset: () => undefined,
  screen: () => undefined,
  track: () => undefined,
});

export function AnalyticsProvider({ children }: PropsWithChildren) {
  const currentUser = useCurrentUser();
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const posthogRef = useRef<PostHog | null>(null);
  const previousSupabaseUserIdRef = useRef<string | null>(null);
  const isConfigured = Boolean(mobileEnv.posthogKey.trim());

  const analytics = useMemo<AnalyticsContextValue>(() => {
    return {
      identify: (distinctId, payload) => {
        if (!posthogRef.current) {
          return;
        }

        posthogRef.current.identify(distinctId, sanitizePayload(payload));
      },
      isConfigured,
      reset: () => {
        posthogRef.current?.reset();
      },
      screen: (name, payload) => {
        if (!posthogRef.current) {
          return;
        }

        void posthogRef.current.screen(name, sanitizePayload(payload));
      },
      track: (event, payload) => {
        if (!posthogRef.current) {
          return;
        }

        posthogRef.current.capture(event, sanitizePayload(payload));
      },
    };
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured || posthogRef.current) {
      return;
    }

    posthogRef.current = new PostHog(mobileEnv.posthogKey, {
      captureAppLifecycleEvents: true,
      host: mobileEnv.posthogHost,
    });
  }, [isConfigured]);

  useEffect(() => {
    if (!posthogRef.current) {
      previousSupabaseUserIdRef.current = null;
      return;
    }

    const currentSupabaseUserId =
      currentUser?.provider === "supabase" ? currentUser.id : null;

    if (
      currentSupabaseUserId &&
      previousSupabaseUserIdRef.current !== currentSupabaseUserId
    ) {
      posthogRef.current.identify(currentSupabaseUserId, {
        auth_mode: currentUser?.provider ?? null,
        category: preferredCategory,
        email: currentUser?.email ?? null,
        full_name: currentUser?.fullName ?? null,
        locale: preferredLocale,
      });
    }

    if (!currentSupabaseUserId && previousSupabaseUserIdRef.current) {
      posthogRef.current.reset();
    }

    previousSupabaseUserIdRef.current = currentSupabaseUserId;
  }, [currentUser, preferredCategory, preferredLocale]);

  return (
    <AnalyticsContext.Provider
      value={analytics}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}

function sanitizePayload(payload?: AnalyticsTrackPayload) {
  if (!payload) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(payload).filter((entry) => entry[1] !== undefined)
  ) as AnalyticsTrackPayload;
}
