import { useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { AppTextInput } from "../../src/components/shell/AppTextInput";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";

export default function SchoolCodeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const existingCode = useAppShellStore((state) => state.studyPlanSetup.schoolCode);
  const setSchoolCode = useAppShellStore((state) => state.setSchoolCode);
  const [value, setValue] = useState(existingCode);

  const continueToAccess = (schoolCode: string) => {
    setSchoolCode(schoolCode.trim().toUpperCase());
    router.push("/(onboarding)/access");
  };

  return (
    <AppScreen
      title={t("onboarding.schoolCodeTitle")}
      subtitle={t("onboarding.schoolCodeSubtitle")}
      footer={
        <View style={{ gap: 10 }}>
          <AppButton
            label={t("common.continue")}
            onPress={() => continueToAccess(value)}
          />
          <AppButton
            variant="ghost"
            label={t("common.back")}
            onPress={() => router.back()}
          />
          <AppButton
            variant="ghost"
            label={t("onboarding.skipSchoolCode")}
            onPress={() => continueToAccess("")}
          />
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        <AppCard>
          <AppTextInput
            autoCapitalize="characters"
            label={t("onboarding.schoolCodeInputLabel")}
            placeholder={t("onboarding.schoolCodePlaceholder")}
            value={value}
            onChangeText={setValue}
          />
        </AppCard>

        <AppCard accent>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 22,
              color: theme.colors.textPrimary,
            }}
          >
            {t("onboarding.schoolCodeHelp")}
          </Text>
        </AppCard>
      </View>
    </AppScreen>
  );
}
