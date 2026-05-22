import { isMobileSupabaseConfigured } from "../../config/env";
import { getMobileSupabaseClient } from "../../lib/supabase";

type RemoteDailyUsageSnapshotRow = {
  question_attempts_used_today: number | string | null;
  warsaw_date: string;
};

export type RemoteDailyUsageSnapshot = {
  questionAttemptsUsedToday: number;
  warsawDate: string;
};

export async function fetchRemoteDailyUsageSnapshot(): Promise<RemoteDailyUsageSnapshot> {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("get_daily_usage_snapshot");

  if (error) {
    throw error;
  }

  const row = (((data ?? []) as unknown) as RemoteDailyUsageSnapshotRow[])[0];

  if (!row) {
    throw new Error("get_daily_usage_snapshot returned an empty response.");
  }

  return {
    questionAttemptsUsedToday: toNumber(row.question_attempts_used_today),
    warsawDate: row.warsaw_date,
  };
}

function toNumber(value: number | string | null) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error("The daily usage snapshot returned an invalid numeric value.");
}
