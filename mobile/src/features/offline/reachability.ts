import { Platform } from "react-native";

import { mobileEnv } from "../../config/env";
import { getE2ETestReachabilityOverride } from "../../testing/e2e/state";

const REACHABILITY_TIMEOUT_MS = 3500;

function buildReachabilityUrls() {
  const urls: string[] = [];

  if (mobileEnv.supabaseUrl) {
    urls.push(
      `${mobileEnv.supabaseUrl.replace(/\/+$/, "")}/auth/v1/health`
    );
  }

  if (mobileEnv.mediaBaseUrl) {
    urls.push(mobileEnv.mediaBaseUrl.replace(/\/+$/, ""));
  } else if (mobileEnv.supabaseUrl) {
    urls.push(
      `${mobileEnv.supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public`
    );
  }

  return Array.from(new Set(urls));
}

async function pingUrl(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache",
      },
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkInternetReachability(
  timeoutMs = REACHABILITY_TIMEOUT_MS
) {
  const e2eOverride = getE2ETestReachabilityOverride();

  if (e2eOverride !== null) {
    return e2eOverride;
  }

  if (
    Platform.OS === "web" &&
    typeof navigator !== "undefined" &&
    "onLine" in navigator &&
    navigator.onLine === false
  ) {
    return false;
  }

  const urls = buildReachabilityUrls();

  if (urls.length === 0) {
    if (
      Platform.OS === "web" &&
      typeof navigator !== "undefined" &&
      "onLine" in navigator
    ) {
      return Boolean(navigator.onLine);
    }

    return true;
  }

  const results = await Promise.all(urls.map((url) => pingUrl(url, timeoutMs)));
  return results.some(Boolean);
}
