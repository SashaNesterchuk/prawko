import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { CText, getFontFamily, useResponsiveStyles } from "../../src/portable-ui";
import { useAppShellStore } from "../../src/state/app-shell";

const MINUTE_OPTIONS = [15, 25, 45, 60] as const;

export default function MinutesScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const studyPlanSetup = useAppShellStore((state) => state.studyPlanSetup);
  const setMinutesPerDay = useAppShellStore((state) => state.setMinutesPerDay);
  const selectedMinutes = studyPlanSetup.minutesPerDay ?? 25;

  return (
    <AppScreen
      title={t("onboarding.minutesTitle")}
      subtitle={t("onboarding.minutesSubtitle")}
      footer={
        <View style={styles.footerStack}>
          <AppButton
            label={t("common.continue")}
            onPress={() => {
              setMinutesPerDay(selectedMinutes);
              router.navigate("/(onboarding)/level");
            }}
          />
          <AppButton
            variant="ghost"
            label={t("common.back")}
            onPress={() => router.back()}
          />
        </View>
      }
    >
      <View style={styles.cardStack}>
        {MINUTE_OPTIONS.map((minutes) => {
          const isActive = selectedMinutes === minutes;

          return (
            <AppCard
              key={minutes}
              accent={isActive}
              onPress={() => setMinutesPerDay(minutes)}
            >
              <CText style={styles.optionTitle}>
                {t("onboarding.minutesOptionTitle", { minutes })}
              </CText>
              <CText style={styles.optionBody}>
                {minutes <= 20
                  ? t("onboarding.minutesOptionMinimum")
                  : t("onboarding.minutesOptionFull")}
              </CText>
            </AppCard>
          );
        })}
      </View>
    </AppScreen>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    footerStack: {
      gap: spacing.exact(10),
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
      color: colors.textSecondary,
    },
  }));
}
