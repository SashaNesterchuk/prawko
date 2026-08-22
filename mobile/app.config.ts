import type { ConfigContext, ExpoConfig } from "expo/config";

// Node-compatible source shared with Metro; do not import React/runtime code here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getVariant } = require("./variants/manifest.cjs");

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = getVariant(process.env.APP_VARIANT);
  const isProductionVariantBuild = process.env.APP_VARIANT_PRODUCTION === "1";

  if (isProductionVariantBuild && !variant.productionReady) {
    throw new Error(
      `Variant "${variant.id}" is not production-ready. Add its own native assets, EAS project ID and store identity first.`
    );
  }

  if (process.env.EAS_BUILD && !variant.easProjectId) {
    throw new Error(
      `Variant "${variant.id}" has no EAS project yet. Create a separate EAS project and add its ID before building.`
    );
  }

  return {
    ...config,
    name: variant.name,
    slug: variant.slug,
    scheme: variant.scheme,
    version: "1.0.18",
    orientation: "portrait",
    icon: variant.assets.icon,
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: variant.assets.splash,
      resizeMode: "contain",
      backgroundColor: "#EEF4F2",
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-localization",
      "expo-secure-store",
      ["expo-notifications", { icon: variant.assets.icon, color: "#1FB574" }],
      "expo-video",
      [
        "react-native-google-mobile-ads",
        {
          androidAppId:
            process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ??
            "ca-app-pub-3940256099942544~3347511713",
          iosAppId:
            process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ??
            "ca-app-pub-4994877133367352~1533006266",
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
      ...(variant.iosAppStoreUrl ? { appStoreUrl: variant.iosAppStoreUrl } : {}),
      config: { usesNonExemptEncryption: false },
      infoPlist: {
        CFBundleDisplayName: variant.name,
        GADApplicationIdentifier:
          process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ??
          "ca-app-pub-4994877133367352~1533006266",
        NSUserNotificationUsageDescription:
          "This app uses notifications to remind you about study sessions.",
      },
    },
    extra: {
      router: { origin: false },
      ...(variant.easProjectId ? { eas: { projectId: variant.easProjectId } } : {}),
      variant: {
        id: variant.id,
        name: variant.name,
        questionSetKey: variant.questionSetKey,
        mediaBaseUrl: variant.mediaBaseUrl,
        defaultLocale: variant.defaultLocale,
        supportedLocales: variant.supportedLocales,
        features: variant.features,
      },
    },
    owner: "mindjar",
    "react-native-google-mobile-ads": {
      android_app_id:
        process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID ??
        "ca-app-pub-3940256099942544~3347511713",
      ios_app_id:
        process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ??
        "ca-app-pub-4994877133367352~1533006266",
    },
  };
};
