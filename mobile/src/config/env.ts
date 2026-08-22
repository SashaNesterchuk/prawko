import { appVariant } from "../app-config/runtime";

function resolveMediaBaseUrl() {
  if (appVariant.id === "prawko") {
    return process.env.EXPO_PUBLIC_MEDIA_BASE_URL ?? appVariant.mediaBaseUrl;
  }

  // Country builds must not inherit Prawko's EXPO_PUBLIC_MEDIA_BASE_URL.
  // That origin is the Polish R2 bucket; Czech files (Q_W_*.webp) are not there.
  if (appVariant.id === "czech") {
    return process.env.EXPO_PUBLIC_CZECH_MEDIA_BASE_URL || "";
  }

  return appVariant.mediaBaseUrl || "";
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
  questionSetKey: process.env.EXPO_PUBLIC_QUESTION_SET_KEY ?? appVariant.questionSetKey,
  mediaBaseUrl: resolveMediaBaseUrl(),
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
