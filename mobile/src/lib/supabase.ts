import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isMobileSupabaseConfigured, mobileEnv } from "../config/env";
import { secureSessionStorage } from "./auth-storage";

let cachedClient: SupabaseClient | null = null;

export function getMobileSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  cachedClient = createClient(
    mobileEnv.supabaseUrl,
    mobileEnv.supabaseAnonKey,
    {
      auth: {
        storage: secureSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    }
  );

  return cachedClient;
}
