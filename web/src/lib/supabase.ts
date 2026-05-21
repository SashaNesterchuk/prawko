import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isWebSupabaseConfigured, webEnv } from "./env";

let browserClient: SupabaseClient | null = null;

export function getWebSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  if (!isWebSupabaseConfigured) {
    throw new Error(
      "Web Supabase env is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  browserClient = createClient(
    webEnv.NEXT_PUBLIC_SUPABASE_URL,
    webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return browserClient;
}
