import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../../src/components/shell/GreenWaveScreen";
import { SignCatalogCard } from "../../../src/components/shell/SignCatalogCard";
import { SignsScreenHeader } from "../../../src/components/shell/SignsScreenHeader";
import {
  useResponsiveSpacing,
  useResponsiveStyles,
} from "../../../src/portable-ui";
import {
  getRoadSignCategory,
  getRoadSignsByCategory,
  isRoadSignCategoryId,
} from "../../../src/features/road-signs/catalog";
import { buildCategorySignTestQuestions } from "../../../src/features/road-signs/category-test";
import { getSignLearningStatus } from "../../../src/features/road-signs/sign-progress";

export default function SignsCategoryScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const styles = useStyles({ safeBottom });
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const resolvedCategoryId =
    categoryId && isRoadSignCategoryId(categoryId) ? categoryId : "A";

  const category = useMemo(
    () => getRoadSignCategory(resolvedCategoryId),
    [resolvedCategoryId]
  );

  const signs = useMemo(
    () => getRoadSignsByCategory(resolvedCategoryId),
    [resolvedCategoryId]
  );
  const hasCategoryTestQuestions = useMemo(
    () => buildCategorySignTestQuestions(resolvedCategoryId).length > 0,
    [resolvedCategoryId]
  );

  const openCategoryTest = () => {
    router.push({
      pathname: "/signs/category/[categoryId]/test",
      params: { categoryId: resolvedCategoryId },
    });
  };

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />
        <SignsScreenHeader
          title={
            category
              ? t(`signs.categories.${category.id}.title`)
              : t("signs.title")
          }
          backLabel={t("common.back")}
          onBack={() => router.back()}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.list}>
            {signs.map((sign) => (
              <SignCatalogCard
                key={sign.id}
                sign={sign}
                showWrongBadge={getSignLearningStatus(sign.id) === "wrong"}
                onPress={() =>
                  router.push({
                    pathname: "/signs/[signId]",
                    params: { signId: sign.id },
                  })
                }
              />
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            disabled={!hasCategoryTestQuestions}
            onPress={openCategoryTest}
            style={({ pressed }) => [
              styles.trainButton,
              !hasCategoryTestQuestions ? styles.trainButtonDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.trainButtonLabel}>{t("signs.trainCategory")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    safeArea: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: spacing.xl,
      paddingBottom: spacing.exact(88) + safeBottom,
    },
    list: {
      gap: spacing.md,
    },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg + safeBottom,
      backgroundColor: colors.transparent,
    },
    trainButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: theme.accents.green.fill,
    },
    trainButtonDisabled: {
      opacity: 0.5,
    },
    trainButtonLabel: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      color: colors.onAccent,
    },
    pressed: {
      opacity: 0.92,
    },
  }));
}
