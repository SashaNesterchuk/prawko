import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { useAppShellStore } from "../../src/state/app-shell";

const INTRO_ITEMS = [
  "onboarding.examIntroCard1",
  "onboarding.examIntroCard2",
  "onboarding.examIntroCard3",
] as const;

export default function ExamIntroScreen() {
  const { t } = useTranslation();
  const markExamIntroSeen = useAppShellStore((state) => state.markExamIntroSeen);

  return (
    <AppScreen
      title={t("onboarding.examIntroTitle")}
      subtitle={t("onboarding.examIntroSubtitle")}
      footer={
        <View style={{ gap: 10 }}>
          <AppButton
            label={t("common.continue")}
            onPress={() => {
              markExamIntroSeen();
              router.push("/(onboarding)/exam-schedule");
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
        {INTRO_ITEMS.map((item) => (
          <AppCard key={item}>
            <Text style={{ fontSize: 16, lineHeight: 24 }}>{t(item)}</Text>
          </AppCard>
        ))}
      </View>
    </AppScreen>
  );
}
