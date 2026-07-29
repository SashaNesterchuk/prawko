import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SUPPORTED_LOCALES, type SupportedLocale } from "@prawko/config";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { NavigationButton } from "../../src/components/shell/NavigationButton";
import { getFontFamily, useResponsiveStyles } from "../../src/portable-ui";
import { useAppShellStore } from "../../src/state/app-shell";

export default function LanguageScreen() {
  const { t } = useTranslation();
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

  const handleSelectLocale = (locale: SupportedLocale) => {
    setPreferredLocale(locale);

    if (isSettingsMode) {
      router.back();
    }
  };

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
            <Text style={styles.topBarTitle}>{t("profile.languageTitle")}</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.settingsContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.cardStack}>
              {SUPPORTED_LOCALES.map((locale) => {
                const isActive = preferredLocale === locale;

                return (
                  <AppCard
                    key={locale}
                    accent={isActive}
                    onPress={() => handleSelectLocale(locale)}
                  >
                    <Text style={styles.optionTitle}>
                      {t(`languages.${locale}.label`)}
                    </Text>
                    <Text style={styles.optionBody}>
                      {t(`languages.${locale}.description`)}
                    </Text>
                    {isActive ? (
                      <Text style={styles.selectedLabel}>
                        {t("common.selected")}
                      </Text>
                    ) : null}
                  </AppCard>
                );
              })}
            </View>
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
          onPress={() => {
            completeLanguageStep();
            router.push("/(onboarding)/category");
          }}
        />
      }
    >
      <View style={styles.cardStack}>
        {SUPPORTED_LOCALES.map((locale) => {
          const isActive = preferredLocale === locale;

          return (
            <AppCard
              key={locale}
              accent={isActive}
              onPress={() => handleSelectLocale(locale)}
            >
              <Text style={styles.optionTitle}>
                {t(`languages.${locale}.label`)}
              </Text>
              <Text style={styles.optionBody}>
                {t(`languages.${locale}.description`)}
              </Text>
              {isActive ? (
                <Text style={styles.selectedLabel}>
                  {t("common.selected")}
                </Text>
              ) : null}
            </AppCard>
          );
        })}
      </View>
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
      gap: spacing.exact(12),
      paddingHorizontal: spacing.exact(20),
      paddingTop: spacing.exact(8),
      paddingBottom: spacing.exact(12),
    },
    topBarTitle: {
      flex: 1,
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontFamily: getFontFamily("bold"),
      color: colors.textPrimary,
    },
    settingsContent: {
      paddingHorizontal: spacing.exact(20),
      paddingBottom: spacing.exact(32),
    },
    cardStack: {
      gap: spacing.exact(12),
    },
    optionTitle: {
      fontSize: responsiveFont(18),
      fontFamily: getFontFamily("bold"),
      color: colors.textPrimary,
      marginBottom: spacing.exact(4),
    },
    optionBody: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
      fontFamily: getFontFamily("regular"),
      color: colors.textSecondary,
    },
    selectedLabel: {
      marginTop: spacing.exact(12),
      fontSize: responsiveFont(12),
      fontFamily: getFontFamily("bold"),
      color: colors.accent,
      textTransform: "uppercase",
    },
  }));
}
