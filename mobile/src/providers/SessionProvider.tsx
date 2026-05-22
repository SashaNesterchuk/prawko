import { PropsWithChildren, useEffect } from "react";

import { isMobileSupabaseConfigured } from "../config/env";
import { getMobileSupabaseClient } from "../lib/supabase";
import { useAppShellStore } from "../state/app-shell";
import { useErrorLogger } from "./ErrorLoggingProvider";

export function SessionProvider({ children }: PropsWithChildren) {
  const { captureError } = useErrorLogger();
  const setSupabaseUser = useAppShellStore((state) => state.setSupabaseUser);
  const setSessionResolved = useAppShellStore(
    (state) => state.setSessionResolved
  );

  useEffect(() => {
    if (!isMobileSupabaseConfigured) {
      setSessionResolved(true);
      return;
    }

    const client = getMobileSupabaseClient();
    let cancelled = false;

    void client.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) {
          return;
        }

        setSupabaseUser(mapSupabaseUser(data.session?.user ?? null));
        setSessionResolved(true);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        captureError({
          area: "auth_session",
          error,
          eventName: "session_bootstrap_failed",
          message: "Failed to restore the Supabase session during app bootstrap.",
          metadata: {
            stage: "get_session",
          },
          severity: "error",
        });
        setSupabaseUser(null);
        setSessionResolved(true);
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(mapSupabaseUser(session?.user ?? null));
      setSessionResolved(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [captureError, setSessionResolved, setSupabaseUser]);

  return children;
}

function mapSupabaseUser(
  user:
    | {
        email?: string | null;
        id: string;
        user_metadata?: {
          full_name?: string | null;
          name?: string | null;
        };
      }
    | null
) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? "",
    fullName:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      "Prawko User",
    provider: "supabase" as const,
  };
}
