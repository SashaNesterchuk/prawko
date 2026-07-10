import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { SUPPORTED_LOCALES } from "@prawko/config";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { getFontFamily, useResponsiveStyles } from "../../src/portable-ui";
import { useAppShellStore } from "../../src/state/app-shell";

export default function LanguageScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const completeLanguageStep = useAppShellStore(
    (state) => state.completeLanguageStep
  );
  const setPreferredLocale = useAppShellStore(
    (state) => state.setPreferredLocale
  );

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
              onPress={() => setPreferredLocale(locale)}
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
