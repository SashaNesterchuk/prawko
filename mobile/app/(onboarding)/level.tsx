import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { PLAN_LEVELS } from "@prawko/config";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { CText, getFontFamily, useResponsiveStyles } from "../../src/portable-ui";
import { useAppShellStore } from "../../src/state/app-shell";

export default function LevelScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const studyPlanSetup = useAppShellStore((state) => state.studyPlanSetup);
  const setLevel = useAppShellStore((state) => state.setLevel);
  const selectedLevel = studyPlanSetup.level ?? "first_time";

  return (
    <AppScreen
      title={t("onboarding.levelTitle")}
      subtitle={t("onboarding.levelSubtitle")}
      footer={
        <View style={styles.footerStack}>
          <AppButton
            label={t("common.continue")}
            onPress={() => {
              setLevel(selectedLevel);
              router.navigate("/(onboarding)/school-code");
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
        {PLAN_LEVELS.map((level) => {
          const isActive = selectedLevel === level;

          return (
            <AppCard key={level} accent={isActive} onPress={() => setLevel(level)}>
              <CText style={styles.optionTitle}>
                {t(`levels.${level}.label`)}
              </CText>
              <CText style={styles.optionBody}>
                {t(`levels.${level}.description`)}
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
