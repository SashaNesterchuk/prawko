function parseBooleanEnv(value: string | undefined, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export const mobileEnv = {
  mediaBaseUrl: process.env.EXPO_PUBLIC_MEDIA_BASE_URL ?? "",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "",
  posthogHost:
    process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  revenueCatAppleApiKey:
    process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ?? "",
  revenueCatGoogleApiKey:
    process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY ?? "",
  admobIosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ?? "",
  admobAndroidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ?? "",
  admobIosInterstitialUnitId:
    process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT_ID ?? "",
  admobAndroidInterstitialUnitId:
    process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_UNIT_ID ?? "",
  enableMockAuth: parseBooleanEnv(
    process.env.EXPO_PUBLIC_ENABLE_MOCK_AUTH,
    false
  ),
};

export const isMobileSupabaseConfigured = Boolean(
  mobileEnv.supabaseUrl && mobileEnv.supabaseAnonKey
);

export const isMockAuthEnabled = mobileEnv.enableMockAuth;
