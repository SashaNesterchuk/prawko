export const mobileEnv = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "",
  posthogHost:
    process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  revenueCatAppleApiKey:
    process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ?? "",
  revenueCatGoogleApiKey:
    process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY ?? "",
};

export const isMobileSupabaseConfigured = Boolean(
  mobileEnv.supabaseUrl && mobileEnv.supabaseAnonKey
);
