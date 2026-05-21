import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";

const MINUTE_OPTIONS = [15, 25, 45, 60] as const;

export default function MinutesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const studyPlanSetup = useAppShellStore((state) => state.studyPlanSetup);
  const setMinutesPerDay = useAppShellStore((state) => state.setMinutesPerDay);
  const selectedMinutes = studyPlanSetup.minutesPerDay ?? 25;

  return (
    <AppScreen
      title={t("onboarding.minutesTitle")}
      subtitle={t("onboarding.minutesSubtitle")}
      footer={
        <View style={{ gap: 10 }}>
          <AppButton
            label={t("common.continue")}
            onPress={() => {
              setMinutesPerDay(selectedMinutes);
              router.push("/(onboarding)/level");
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
        {MINUTE_OPTIONS.map((minutes) => {
          const isActive = selectedMinutes === minutes;

          return (
            <AppCard
              key={minutes}
              accent={isActive}
              onPress={() => setMinutesPerDay(minutes)}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: theme.colors.textPrimary,
                  marginBottom: 4,
                }}
              >
                {t("onboarding.minutesOptionTitle", { minutes })}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 22,
                  color: theme.colors.textSecondary,
                }}
              >
                {minutes <= 20
                  ? t("onboarding.minutesOptionMinimum")
                  : t("onboarding.minutesOptionFull")}
              </Text>
            </AppCard>
          );
        })}
      </View>
    </AppScreen>
  );
}
