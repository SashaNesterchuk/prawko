import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { isMobileSupabaseConfigured } from "../config/env";
import { getMobileSupabaseClient } from "../lib/supabase";
import { readAppleSearchAdsAttributionToken } from "../../modules/apple-search-ads/src/AppleSearchAdsModule";
import {
  APPLE_SEARCH_ADS_STORAGE_KEY,
  applyExchange,
  applyFetchedToken,
  parseStoredAppleSearchAds,
  planAppleSearchAds,
  unavailableRecord,
  type AppleSearchAdsExchange,
  type AppleSearchAdsProperties,
  type AppleSearchAdsRecord,
} from "./apple-search-ads";

export type AppleSearchAdsStepResult = {
  retryInMs: number | null;
};

type AppleSearchAdsIo = {
  capture: (properties: AppleSearchAdsProperties) => void;
  now: () => number;
  register: (properties: AppleSearchAdsProperties) => Promise<void>;
};

export async function stepAppleSearchAdsAttribution(
  io: AppleSearchAdsIo,
): Promise<AppleSearchAdsStepResult> {
  if (Platform.OS !== "ios") return { retryInMs: null };

  const state = await loadAppleSearchAdsRecord();
  const now = io.now();
  const plan = planAppleSearchAds(state, now);

  if (plan.kind === "register") {
    await io.register(plan.properties);
    if (state && state.status !== "pending" && !state.captured) {
      io.capture(state.properties);
      await saveAppleSearchAdsRecord({ ...state, captured: true });
    }
    return { retryInMs: null };
  }

  if (plan.kind === "wait") return { retryInMs: plan.delayMs };

  if (plan.kind === "give_up") {
    return finish(io, unavailableRecord(now, "unresolved"));
  }

  if (plan.kind === "fetch_token") {
    try {
      const token = await readAppleSearchAdsAttributionToken();
      const next = applyFetchedToken(state, io.now(), token);
      await saveAppleSearchAdsRecord(next);
      if (next.status !== "pending") return finish(io, next);
      const delay = Math.max(0, next.nextAttemptAt - io.now());
      return { retryInMs: delay };
    } catch {
      return finish(io, unavailableRecord(io.now(), "token_error"));
    }
  }

  if (!state || state.status !== "pending") return { retryInMs: 60_000 };

  const next = applyExchange(state, io.now(), await exchangeAppleSearchAdsToken(state.token));
  await saveAppleSearchAdsRecord(next);
  if (next.status !== "pending") return finish(io, next);
  return { retryInMs: Math.max(0, next.nextAttemptAt - io.now()) };
}

async function finish(
  io: AppleSearchAdsIo,
  record: Extract<AppleSearchAdsRecord, { status: "resolved" | "unavailable" }>,
): Promise<AppleSearchAdsStepResult> {
  await saveAppleSearchAdsRecord(record);
  io.capture(record.properties);
  await saveAppleSearchAdsRecord({ ...record, captured: true });
  await io.register(record.properties);
  return { retryInMs: null };
}

async function loadAppleSearchAdsRecord() {
  try {
    return parseStoredAppleSearchAds(await AsyncStorage.getItem(APPLE_SEARCH_ADS_STORAGE_KEY));
  } catch {
    return null;
  }
}

async function saveAppleSearchAdsRecord(record: AppleSearchAdsRecord) {
  await AsyncStorage.setItem(APPLE_SEARCH_ADS_STORAGE_KEY, JSON.stringify(record));
}

async function exchangeAppleSearchAdsToken(token: string): Promise<AppleSearchAdsExchange> {
  if (!isMobileSupabaseConfigured) return { outcome: "retry" };

  try {
    const { data, error } = await getMobileSupabaseClient().functions.invoke(
      "apple-search-ads-attribution",
      { body: { token } },
    );
    if (error || !data || typeof data !== "object") return { outcome: "retry" };
    const outcome = (data as { outcome?: unknown }).outcome;
    if (outcome === "invalid_token") return { outcome: "invalid_token" };
    if (outcome === "resolved") {
      return { outcome: "resolved", apple: (data as { payload?: unknown }).payload };
    }
    return { outcome: "retry" };
  } catch {
    return { outcome: "retry" };
  }
}
