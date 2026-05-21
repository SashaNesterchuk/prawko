import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { PLAN_LEVELS } from "@prawko/config";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";

export default function LevelScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const studyPlanSetup = useAppShellStore((state) => state.studyPlanSetup);
  const setLevel = useAppShellStore((state) => state.setLevel);
  const selectedLevel = studyPlanSetup.level ?? "first_time";

  return (
    <AppScreen
      title={t("onboarding.levelTitle")}
      subtitle={t("onboarding.levelSubtitle")}
      footer={
        <View style={{ gap: 10 }}>
          <AppButton
            label={t("common.continue")}
            onPress={() => {
              setLevel(selectedLevel);
              router.push("/(onboarding)/school-code");
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
      <View style={{ gap: 12 }}>
        {PLAN_LEVELS.map((level) => {
          const isActive = selectedLevel === level;

          return (
            <AppCard key={level} accent={isActive} onPress={() => setLevel(level)}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: theme.colors.textPrimary,
                  marginBottom: 4,
                }}
              >
                {t(`levels.${level}.label`)}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 22,
                  color: theme.colors.textSecondary,
                }}
              >
                {t(`levels.${level}.description`)}
              </Text>
            </AppCard>
          );
        })}
      </View>
    </AppScreen>
  );
}
