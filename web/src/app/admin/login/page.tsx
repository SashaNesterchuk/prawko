import type { Metadata } from "next";

import { AdminMessage } from "../../../components/admin/AdminPageHeader";
import { getAdminAuthReadiness, normalizeAdminNextPath } from "../../../lib/admin-auth";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Admin Login",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const readiness = getAdminAuthReadiness();
  const error = firstSearchParam(params.error);
  const email = firstSearchParam(params.email) ?? "";
  const nextPath = normalizeAdminNextPath(firstSearchParam(params.next));
  const signedOut = firstSearchParam(params.signed_out) === "1";

  return (
    <main className="admin-login-shell">
      <div className="admin-login-card">
        <p className="section-kicker">Admin access</p>
        <h1>Sign in to the Prawko backoffice.</h1>
        <p className="admin-login-copy">
          This gate protects service-role backed pages for school operations,
          import health, and AI review.
        </p>

        {signedOut ? (
          <AdminMessage tone="success">You have been signed out.</AdminMessage>
        ) : null}
        {error ? <AdminMessage tone="error">{getLoginErrorMessage(error)}</AdminMessage> : null}
        {!readiness.isConfigured ? (
          <AdminMessage tone="error">
            Admin auth is not configured. Missing env: {readiness.missing.join(", ")}.
          </AdminMessage>
        ) : null}

        <form action="/admin/auth/login" className="admin-form-grid" method="post">
          <input name="next" type="hidden" value={nextPath} />

          <label className="field">
            <span>Admin email</span>
            <input
              defaultValue={email}
              name="email"
              placeholder="admin@prawko.app"
              type="email"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input name="password" placeholder="Admin password" type="password" />
          </label>

          <button className="primary-button" disabled={!readiness.isConfigured} type="submit">
            Sign in
          </button>
        </form>

        <div className="admin-login-footer">
          <p>Allowed emails: {readiness.allowedEmails.length ? readiness.allowedEmails.join(", ") : "not configured"}</p>
        </div>
      </div>
    </main>
  );
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function getLoginErrorMessage(code: string) {
  switch (code) {
    case "missing_credentials":
      return "Enter both admin email and password.";
    case "invalid_credentials":
      return "That email/password pair is not allowed.";
    case "auth_not_configured":
      return "Admin auth is not configured yet.";
    default:
      return code;
  }
}
