function envOr(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

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
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  enableE2ETestMode: parseBooleanEnv(
    process.env.EXPO_PUBLIC_E2E_TEST_MODE,
    false
  ),
  posthogKey:
    process.env.EXPO_PUBLIC_POSTHOG_KEY ||
    "phc_ksus5JCVVcb52pcjPHCBurMmXHc9nijfpYhVfAifGenR",
  posthogHost:
    process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
  revenueCatAppleApiKey:
    process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ?? "",
  revenueCatGoogleApiKey:
    process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY ?? "",
  // Every fresh install registers another anonymous customer in the shared
  // RevenueCat project, so dev builds stay out of it until purchases are
  // actually being tested.
  revenueCatEnableInDev: parseBooleanEnv(
    process.env.EXPO_PUBLIC_REVENUECAT_ENABLE_IN_DEV,
    false
  ),
  admobIosAppId: envOr(
    process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
    "ca-app-pub-4994877133367352~1533006266",
  ),
  admobAndroidAppId: envOr(
    process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
    "ca-app-pub-4994877133367352~7730175532",
  ),
  admobIosInterstitialUnitId: envOr(
    process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT_ID,
    "ca-app-pub-4994877133367352/9403561308",
  ),
  admobAndroidInterstitialUnitId: envOr(
    process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_UNIT_ID,
    "ca-app-pub-4994877133367352/1525071282",
  ),
  enableMockAuth: parseBooleanEnv(
    process.env.EXPO_PUBLIC_ENABLE_MOCK_AUTH,
    false
  ),
  // When false, the question catalog loads from Supabase without a signed-in user.
  // Set EXPO_PUBLIC_REQUIRE_AUTH_FOR_QUESTION_CATALOG=true once auth ships.
  requireAuthForQuestionCatalog: parseBooleanEnv(
    process.env.EXPO_PUBLIC_REQUIRE_AUTH_FOR_QUESTION_CATALOG,
    false
  ),
};

export const isMobileSupabaseConfigured = Boolean(
  mobileEnv.supabaseUrl && mobileEnv.supabaseAnonKey
);

export const isMockAuthEnabled = mobileEnv.enableMockAuth;
