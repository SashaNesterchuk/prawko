import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { ACTIVE_CATEGORIES } from "@prawko/config";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";

const FUTURE_CATEGORIES = ["A", "C", "D"] as const;

export default function CategoryScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const preferredCategory = useAppShellStore(
    (state) => state.preferredCategory
  );
  const completeCategoryStep = useAppShellStore(
    (state) => state.completeCategoryStep
  );
  const setPreferredCategory = useAppShellStore(
    (state) => state.setPreferredCategory
  );

  return (
    <AppScreen
      title={t("onboarding.categoryTitle")}
      subtitle={t("onboarding.categorySubtitle")}
      footer={
        <View style={{ gap: 10 }}>
          <AppButton
            label={t("common.continue")}
            onPress={() => {
              completeCategoryStep();
              router.push("/(onboarding)/exam-intro");
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
        {ACTIVE_CATEGORIES.map((category) => {
          const isActive = preferredCategory === category;

          return (
            <AppCard
              key={category}
              accent={isActive}
              onPress={() => setPreferredCategory(category)}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: theme.colors.textPrimary,
                  marginBottom: 4,
                }}
              >
                {t("onboarding.categoryBTitle")}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 22,
                  color: theme.colors.textSecondary,
                }}
              >
                {t("onboarding.categoryBSubtitle")}
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

        {FUTURE_CATEGORIES.map((category) => (
          <AppCard key={category}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: theme.colors.textPrimary,
                marginBottom: 4,
              }}
            >
              {category}
            </Text>
            <Text
              style={{
                fontSize: 14,
                lineHeight: 22,
                color: theme.colors.textSecondary,
              }}
            >
              {t("onboarding.categoryLockedSubtitle")}
            </Text>
          </AppCard>
        ))}
      </View>
    </AppScreen>
  );
}
