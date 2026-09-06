import type { ConfigContext, ExpoConfig } from "expo/config";

const ADMOB_ANDROID_APP_ID = "ca-app-pub-4994877133367352~7730175532";
const ADMOB_IOS_APP_ID = "ca-app-pub-4994877133367352~1533006266";
const EAS_PROJECT_ID = "db4df591-0771-4d6f-a7bf-3fd1304bb080";
const ICON = "./assets/images/icon.png";
const SPLASH = "./assets/images/splash-icon.png";

function envOr(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: "Prawko",
    slug: "prawko",
    scheme: "prawko",
    version: "1.0.20",
    orientation: "portrait",
    icon: ICON,
    userInterfaceStyle: "light",
    splash: {
      image: SPLASH,
      resizeMode: "contain",
      backgroundColor: "#EEF4F2",
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-splash-screen",
      "expo-localization",
      "expo-secure-store",
      ["expo-notifications", { icon: ICON, color: "#1FB574" }],
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
      package: "com.mindjar.prawko",
      playStoreUrl:
        "https://play.google.com/store/apps/details?id=com.mindjar.prawko",
      adaptiveIcon: {
        foregroundImage: ICON,
        backgroundColor: "#EEF4F2",
      },
    },
    ios: {
      bundleIdentifier: "com.mindjar.prawko",
      supportsTablet: false,
      appleTeamId: "6ZQHZ3FP75",
      deploymentTarget: "16.4",
      appStoreUrl: "https://apps.apple.com/app/id6795258105",
      config: { usesNonExemptEncryption: false },
      infoPlist: {
        CFBundleDisplayName: "Prawko",
        GADApplicationIdentifier: envOr(
          process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
          ADMOB_IOS_APP_ID,
        ),
        NSUserNotificationUsageDescription:
          "This app uses notifications to remind you about study sessions.",
      },
    },
    extra: {
      router: { origin: false },
      eas: { projectId: EAS_PROJECT_ID },
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
