import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { SUPPORTED_LOCALES } from "@prawko/config";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";

export default function LanguageScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
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
      <View style={{ gap: 12 }}>
        {SUPPORTED_LOCALES.map((locale) => {
          const isActive = preferredLocale === locale;

          return (
            <AppCard
              key={locale}
              accent={isActive}
              onPress={() => setPreferredLocale(locale)}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: theme.colors.textPrimary,
                  marginBottom: 4,
                }}
              >
                {t(`languages.${locale}.label`)}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 22,
                  color: theme.colors.textSecondary,
                }}
              >
                {t(`languages.${locale}.description`)}
              </Text>
              {isActive ? (
                <Text
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    fontWeight: "700",
                    color: theme.colors.accent,
                    textTransform: "uppercase",
                  }}
                >
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
