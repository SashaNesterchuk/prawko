import { useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { AppTextInput } from "../../src/components/shell/AppTextInput";
import { useResponsiveStyles } from "../../src/portable-ui";
import { useAppShellStore } from "../../src/state/app-shell";

export default function SchoolCodeScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
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
        <View style={styles.footerStack}>
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
      <View style={styles.cardStack}>
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
          <Text style={styles.helpText}>
            {t("onboarding.schoolCodeHelp")}
          </Text>
        </AppCard>
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
    helpText: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
      color: colors.textPrimary,
    },
  }));
}
