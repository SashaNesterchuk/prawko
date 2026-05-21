import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getWebServerEnv } from "./server-env";

export function getWebSupabaseAdminClient(): SupabaseClient {
  const env = getWebServerEnv();

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Web admin Supabase env is missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );
}
