"use client";

import {
  DEFAULT_CATEGORY,
  EXAM_RULES,
  SUPPORTED_LOCALES,
} from "@prawko/config";
import { type Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

import { isWebSupabaseConfigured, webEnv } from "../lib/env";
import { getWebSupabaseBrowserClient } from "../lib/supabase";

type AuthMode = "sign_in" | "sign_up";
type SampleQuestion = {
  question_source_id: string;
  source_row_number: number;
  question_pl: string;
  question_ua: string | null;
  question_en: string | null;
};
type CatalogState = {
  count: number;
  questions: SampleQuestion[];
} | null;

const PASSWORD_MIN_LENGTH = 6;

export default function HomePage() {
  const client = useMemo(
    () => (isWebSupabaseConfigured ? getWebSupabaseBrowserClient() : null),
    []
  );
  const [authMode, setAuthMode] = useState<AuthMode>("sign_in");
  const [session, setSession] = useState<Session | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalogState, setCatalogState] = useState<CatalogState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  useEffect(() => {
    if (!client) {
      return;
    }

    void client.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    if (!client || !session?.user) {
      setCatalogState(null);
      return;
    }

    let cancelled = false;
    setIsCatalogLoading(true);
    setError(null);

    void (async () => {
      try {
        const { data, count, error: catalogError } = await client
          .from("questions")
          .select(
            "question_source_id, source_row_number, question_pl, question_ua, question_en",
            {
              count: "exact",
            }
          )
          .eq("is_active", true)
          .contains("categories", [DEFAULT_CATEGORY])
          .order("source_row_number", { ascending: true })
          .limit(3);

        if (cancelled) {
          return;
        }

        if (catalogError) {
          setCatalogState(null);
          setError(catalogError.message);
          return;
        }

        setCatalogState({
          count: count ?? 0,
          questions: (data ?? []) as SampleQuestion[],
        });
      } finally {
        if (!cancelled) {
          setIsCatalogLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, session?.user]);

  const isSignUp = authMode === "sign_up";

  async function handleSubmit() {
    if (!client || !isWebSupabaseConfigured) {
      setError("Web Supabase env is missing.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFullName = fullName.trim();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Enter a valid email.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (isSignUp && !normalizedFullName) {
      setError("Full name is required for sign up.");
      return;
    }

    if (isSignUp && password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await client.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: normalizedFullName,
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        setFeedback(
          data.session
            ? "Account created and signed in."
            : "Account created. Sign in with your email and password."
        );
      } else {
        const { error: signInError } = await client.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (signInError) {
          throw signInError;
        }

        setFeedback("Signed in. Questions should now load through RLS.");
      }
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    if (!client) {
      return;
    }

    setError(null);
    setFeedback(null);
    const { error: signOutError } = await client.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    setCatalogState(null);
    setFeedback("Signed out.");
  }

  return (
    <main className="page">
      <section className="hero hero-grid">
        <div>
          <p className="eyebrow">Prawko</p>
          <h1>Local Auth And Catalog Check</h1>
          <p className="copy">
            This page is now a real Supabase auth playground for local
            development. Sign in, then verify that authenticated RLS can read
            the Category B question catalog.
          </p>
        </div>

        <div className="hero-panel">
          <p className="hero-panel-label">Local stack</p>
          <p className="hero-panel-value">
            {webEnv.NEXT_PUBLIC_SUPABASE_URL || "missing"}
          </p>
          <p className="hero-panel-copy">
            Email confirmations are disabled in local Supabase, so sign up
            should produce an immediate usable account.
          </p>
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Current category</h2>
          <p>{DEFAULT_CATEGORY}</p>
        </article>
        <article className="card">
          <h2>Supported locales</h2>
          <p>{SUPPORTED_LOCALES.join(", ")}</p>
        </article>
        <article className="card">
          <h2>Exam format</h2>
          <p>
            {EXAM_RULES.totalQuestions} questions / {EXAM_RULES.durationMinutes}{" "}
            minutes
          </p>
        </article>
        <article className="card">
          <h2>Supabase env</h2>
          <p>{isWebSupabaseConfigured ? "configured" : "missing"}</p>
        </article>
      </section>

      <section className="lab-grid">
        <article className="card auth-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Auth</p>
              <h2>Email + password</h2>
            </div>
            <div className="segmented">
              <button
                className={authMode === "sign_in" ? "segment active" : "segment"}
                onClick={() => setAuthMode("sign_in")}
                type="button"
              >
                Sign in
              </button>
              <button
                className={authMode === "sign_up" ? "segment active" : "segment"}
                onClick={() => setAuthMode("sign_up")}
                type="button"
              >
                Sign up
              </button>
            </div>
          </div>

          <div className="form-stack">
            {isSignUp ? (
              <label className="field">
                <span>Full name</span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Sasha Driver"
                />
              </label>
            ) : null}
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="student@prawko.local"
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="min. 6 characters"
              />
            </label>
          </div>

          {feedback ? <p className="status success">{feedback}</p> : null}
          {error ? <p className="status error">{error}</p> : null}

          <div className="action-row">
            <button
              className="primary-button"
              disabled={!isWebSupabaseConfigured || isSubmitting}
              onClick={() => void handleSubmit()}
              type="button"
            >
              {isSubmitting ? "Working..." : isSignUp ? "Create account" : "Sign in"}
            </button>
            <button
              className="secondary-button"
              disabled={!session?.user}
              onClick={() => void handleSignOut()}
              type="button"
            >
              Sign out
            </button>
          </div>
        </article>

        <article className="card auth-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Session</p>
              <h2>Authenticated catalog access</h2>
            </div>
          </div>

          <dl className="kv-list">
            <div>
              <dt>Status</dt>
              <dd>{session?.user ? "authenticated" : "anonymous"}</dd>
            </div>
            <div>
              <dt>User</dt>
              <dd>{session?.user?.email ?? "none"}</dd>
            </div>
            <div>
              <dt>Catalog load</dt>
              <dd>{isCatalogLoading ? "loading" : catalogState ? "ready" : "idle"}</dd>
            </div>
            <div>
              <dt>Category B count</dt>
              <dd>{catalogState?.count ?? 0}</dd>
            </div>
          </dl>

          <div className="sample-list">
            {catalogState?.questions.length ? (
              catalogState.questions.map((question) => (
                <article key={question.question_source_id} className="sample-card">
                  <p className="sample-id">
                    #{question.source_row_number} / {question.question_source_id}
                  </p>
                  <p className="sample-copy">{question.question_pl}</p>
                  <p className="sample-copy muted">
                    UA: {question.question_ua ?? "missing"}
                  </p>
                  <p className="sample-copy muted">
                    EN: {question.question_en ?? "missing"}
                  </p>
                </article>
              ))
            ) : (
              <p className="copy compact">
                Sign in first. Anonymous requests stay blocked by RLS, so this
                panel is the fastest local proof that auth and catalog access are
                wired correctly.
              </p>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && message.trim()
    ? message
    : "Unknown auth error.";
}
