import { SUPPORTED_COUNTRY_CODES, type CountryCode } from "@prawko/config";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionTile } from "../../src/components/shell/ActionTile";
import { CountryFlag } from "../../src/components/shell/CountryFlag";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { NavigationButton } from "../../src/components/shell/NavigationButton";
import { useCountryConfig } from "../../src/countries/use-country";
import { CText, getFontFamily, useResponsiveStyles } from "../../src/portable-ui";
import {
  ANALYTICS_EVENTS,
  ANALYTICS_EXAM_COUNTRY_SOURCES,
  ANALYTICS_PROPERTIES,
} from "../../src/analytics/catalog";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";
import { useAppShellStore } from "../../src/state/app-shell";

export default function ExamCountryScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const styles = useStyles();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const onboardingCompleted = useAppShellStore(
    (state) => state.onboardingCompleted,
  );
  const isSettingsMode = modeParam === "settings" || onboardingCompleted;
  const countryConfig = useCountryConfig();
  const examCountry = useAppShellStore((state) => state.examCountry);
  const setExamCountry = useAppShellStore((state) => state.setExamCountry);

  const handleSelectCountry = (country: CountryCode) => {
    if (country === examCountry) {
      if (isSettingsMode) {
        router.back();
      }
      return;
    }

    const previous = examCountry;
    setExamCountry(country);
    track(ANALYTICS_EVENTS.examCountryChanged.key, {
      [ANALYTICS_PROPERTIES.examCountry]: country,
      [ANALYTICS_PROPERTIES.previous]: previous,
      [ANALYTICS_PROPERTIES.source]: ANALYTICS_EXAM_COUNTRY_SOURCES.settings,
    });

    if (isSettingsMode) {
      router.back();
    }
  };

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
            <CText style={styles.topBarTitle} testID="screen-settings-exam-country">
            {t("profile.examCountryTitle")}
          </CText>
        </View>

        <ScrollView
          contentContainerStyle={styles.settingsContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cardStack} testID="exam-country-list">
            {SUPPORTED_COUNTRY_CODES.map((country) => {
              const isActive = countryConfig.code === country;

              return (
                <ActionTile
                  key={country}
                  fullWidth
                  selected={isActive}
                  style="faded"
                  testID={`exam-country-${country}`}
                      title={t(`countries.${country}.name`)}
                      subtitle={t(`countries.${country}.description`)}
                  icon={<CountryFlag country={country} />}
                  onPress={() => handleSelectCountry(country)}
                />
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
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
