import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type SupportedLocale } from "@prawko/config";

import { ActionTile } from "../../src/components/shell/ActionTile";
import { AppButton } from "../../src/components/shell/AppButton";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { LocaleFlag } from "../../src/components/shell/LocaleFlag";
import { NavigationButton } from "../../src/components/shell/NavigationButton";
import { CText, getFontFamily, useResponsiveStyles } from "../../src/portable-ui";
import { useCountryConfig } from "../../src/countries/use-country";
import { useAppShellStore } from "../../src/state/app-shell";
import { ANALYTICS_EVENTS } from "../../src/analytics/catalog";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";

export default function LanguageScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const styles = useStyles();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const onboardingCompleted = useAppShellStore(
    (state) => state.onboardingCompleted
  );
  const isSettingsMode = modeParam === "settings" || onboardingCompleted;
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const completeLanguageStep = useAppShellStore(
    (state) => state.completeLanguageStep
  );
  const setPreferredLocale = useAppShellStore(
    (state) => state.setPreferredLocale
  );
  const countryConfig = useCountryConfig();

  const handleSelectLocale = (locale: SupportedLocale) => {
    setPreferredLocale(locale);

    if (isSettingsMode) {
      track(ANALYTICS_EVENTS.settingsChanged.key, {
        setting: "locale",
        value: locale,
      });
      router.back();
    }
  };

  const languageList = (
    <View style={styles.cardStack} testID="onboarding-language-list">
      {countryConfig.supportedLocales.map((locale) => {
        const supportedLocale = locale as SupportedLocale;
        const isActive = preferredLocale === supportedLocale;

        return (
          <ActionTile
            key={supportedLocale}
            fullWidth
            selected={isActive}
            style="faded"
            testID={`onboarding-language-${supportedLocale}`}
            title={t(`languages.${supportedLocale}.label`)}
            subtitle={t(`languages.${supportedLocale}.description`)}
            icon={<LocaleFlag locale={supportedLocale} />}
            onPress={() => handleSelectLocale(supportedLocale)}
          />
        );
      })}
    </View>
  );

  if (isSettingsMode) {
    return (
      <GreenWaveScreen>
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <StatusBar style="dark" />
          <View style={styles.topBar}>
            <NavigationButton
              accessibilityLabel={t("common.back")}
              onPress={() => router.back()}
              type="back"
              inset
            />
            <CText style={styles.topBarTitle}>{t("profile.languageTitle")}</CText>
          </View>

          <ScrollView
            contentContainerStyle={styles.settingsContent}
            showsVerticalScrollIndicator={false}
          >
            {languageList}
          </ScrollView>
        </SafeAreaView>
      </GreenWaveScreen>
    );
  }

  return (
    <AppScreen
      title={t("onboarding.languageTitle")}
      subtitle={t("onboarding.languageSubtitle")}
      footer={
        <AppButton
          label={t("common.continue")}
          testID="onboarding-language-continue"
          onPress={() => {
            completeLanguageStep();
            track(ANALYTICS_EVENTS.onboardingStepCompleted.key, {
              locale: preferredLocale,
              step: "language",
            });
            router.navigate("/(onboarding)/category");
          }}
        />
      }
    >
      {languageList}
    </AppScreen>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    safeArea: {
      flex: 1,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(16),
      paddingHorizontal: spacing.exact(24),
      paddingTop: spacing.exact(8),
      paddingBottom: spacing.exact(12),
    },
    topBarTitle: {
      flex: 1,
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontFamily: getFontFamily("semiBold"),
      color: colors.textPrimary,
    },
    settingsContent: {
      paddingHorizontal: spacing.exact(24),
      paddingTop: spacing.exact(12),
      paddingBottom: spacing.exact(32),
    },
    cardStack: {
      gap: spacing.exact(8),
      width: "100%" as const,
    },
  }));
}
