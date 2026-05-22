import crypto from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getWebServerEnv } from "./server-env";

export const ADMIN_SESSION_COOKIE = "prawko_admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type AdminSessionPayload = {
  email: string;
  exp: number;
};

export type AdminSession = {
  email: string;
  expiresAt: number;
};

export function getAdminAuthReadiness() {
  const env = getWebServerEnv();
  const missing: string[] = [];

  if (!env.AUTH_SECRET.trim()) {
    missing.push("AUTH_SECRET");
  }

  if (!env.ADMIN_PASSWORD.trim()) {
    missing.push("ADMIN_PASSWORD");
  }

  if (!getAdminAllowedEmails().length) {
    missing.push("ADMIN_EMAILS");
  }

  return {
    allowedEmails: getAdminAllowedEmails(),
    isConfigured: missing.length === 0,
    missing,
  };
}

export function normalizeAdminNextPath(value: string | null | undefined) {
  if (!value) {
    return "/admin";
  }

  const normalized = value.trim();

  if (!normalized.startsWith("/admin")) {
    return "/admin";
  }

  if (
    normalized === "/admin/login" ||
    normalized.startsWith("/admin/auth")
  ) {
    return "/admin";
  }

  return normalized;
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!cookieValue) {
    return null;
  }

  return verifyAdminSessionToken(cookieValue);
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return session;
}

export async function createAdminSession(email: string) {
  const cookieStore = await cookies();

  cookieStore.set({
    name: ADMIN_SESSION_COOKIE,
    value: createAdminSessionCookieValue(email),
    ...buildAdminCookieOptions(),
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export function verifyAdminCredentials(email: string, password: string) {
  const readiness = getAdminAuthReadiness();

  if (!readiness.isConfigured) {
    return {
      ok: false as const,
      reason: "auth_not_configured" as const,
    };
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return {
      ok: false as const,
      reason: "missing_credentials" as const,
    };
  }

  if (!getAdminAllowedEmails().includes(normalizedEmail)) {
    return {
      ok: false as const,
      reason: "invalid_credentials" as const,
    };
  }

  if (!safeCompare(password, getWebServerEnv().ADMIN_PASSWORD.trim())) {
    return {
      ok: false as const,
      reason: "invalid_credentials" as const,
    };
  }

  return {
    ok: true as const,
    email: normalizedEmail,
  };
}

export function buildAdminCookieOptions() {
  return {
    httpOnly: true,
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/admin",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function createAdminSessionCookieValue(email: string) {
  return signAdminSessionToken(email);
}

function getAdminAllowedEmails() {
  return getWebServerEnv()
    .ADMIN_EMAILS.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function signAdminSessionToken(email: string) {
  const payload: AdminSessionPayload = {
    email,
    exp: Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifyAdminSessionToken(token: string): AdminSession | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  if (!safeCompare(signature, sign(encodedPayload))) {
    return null;
  }

  let payload: AdminSessionPayload;

  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as AdminSessionPayload;
  } catch {
    return null;
  }

  if (!payload.email || !payload.exp || payload.exp <= Date.now()) {
    return null;
  }

  if (!getAdminAllowedEmails().includes(payload.email.toLowerCase())) {
    return null;
  }

  return {
    email: payload.email,
    expiresAt: payload.exp,
  };
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", getWebServerEnv().AUTH_SECRET.trim())
    .update(value)
    .digest("base64url");
}

function safeCompare(left: string, right: string) {
  const leftDigest = crypto.createHash("sha256").update(left).digest();
  const rightDigest = crypto.createHash("sha256").update(right).digest();

  return crypto.timingSafeEqual(leftDigest, rightDigest);
}
