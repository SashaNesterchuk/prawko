import type { ConfigContext, ExpoConfig } from "expo/config";

// Node-compatible source shared with Metro; do not import React/runtime code here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getVariant } = require("./variants/manifest.cjs");

const ADMOB_ANDROID_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const ADMOB_IOS_APP_ID = "ca-app-pub-4994877133367352~1533006266";

function envOr(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = getVariant(process.env.APP_VARIANT);
  const isProductionVariantBuild = process.env.APP_VARIANT_PRODUCTION === "1";

  if (isProductionVariantBuild && !variant.productionReady) {
    throw new Error(
      `Variant "${variant.id}" is not production-ready. Add its own native assets, EAS project ID and store identity first.`,
    );
  }

  if (process.env.EAS_BUILD && !variant.easProjectId) {
    throw new Error(
      `Variant "${variant.id}" has no EAS project yet. Create a separate EAS project and add its ID before building.`,
    );
  }

  const displayName = variant.displayName ?? variant.name;

  return {
    ...config,
    name: displayName,
    slug: variant.slug,
    scheme: variant.scheme,
    version: "1.0.19",
    orientation: "portrait",
    icon: variant.assets.icon,
    userInterfaceStyle: "light",
    splash: {
      image: variant.assets.splash,
      resizeMode: "contain",
      backgroundColor: "#EEF4F2",
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-splash-screen",
      "expo-localization",
      "expo-secure-store",
      ["expo-notifications", { icon: variant.assets.icon, color: "#1FB574" }],
      "expo-video",
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: envOr(
            process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
            ADMOB_ANDROID_APP_ID,
          ),
          iosAppId: envOr(
            process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
            ADMOB_IOS_APP_ID,
          ),
        },
      ],
    ],
    experiments: { typedRoutes: true },
    android: {
      package: variant.androidPackage,
      ...(variant.androidPlayStoreUrl
        ? { playStoreUrl: variant.androidPlayStoreUrl }
        : {}),
      adaptiveIcon: {
        foregroundImage: variant.assets.icon,
        backgroundColor: "#EEF4F2",
      },
    },
    ios: {
      bundleIdentifier: variant.iosBundleIdentifier,
      supportsTablet: false,
      appleTeamId: "6ZQHZ3FP75",
      ...(variant.iosAppStoreUrl
        ? { appStoreUrl: variant.iosAppStoreUrl }
        : {}),
      config: { usesNonExemptEncryption: false },
      infoPlist: {
        CFBundleDisplayName: displayName,
        GADApplicationIdentifier:
          envOr(
            process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
            ADMOB_IOS_APP_ID,
          ),
        NSUserNotificationUsageDescription:
          "This app uses notifications to remind you about study sessions.",
      },
    },
    extra: {
      router: { origin: false },
      ...(variant.easProjectId
        ? { eas: { projectId: variant.easProjectId } }
        : {}),
      variant: {
        id: variant.id,
        name: displayName,
        questionSetKey: variant.questionSetKey,
        mediaBaseUrl: variant.mediaBaseUrl,
        defaultLocale: variant.defaultLocale,
        supportedLocales: variant.supportedLocales,
        features: variant.features,
      },
    },
    owner: "mindjar",
    "react-native-google-mobile-ads": {
      android_app_id: envOr(
        process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
        ADMOB_ANDROID_APP_ID,
      ),
      ios_app_id: envOr(
        process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
        ADMOB_IOS_APP_ID,
      ),
    },
  };
};
