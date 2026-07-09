import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../../src/components/shell/GreenWaveScreen";
import { SignCatalogCard } from "../../../src/components/shell/SignCatalogCard";
import { SignsScreenHeader } from "../../../src/components/shell/SignsScreenHeader";
import {
  getRoadSignCategory,
  getRoadSignsByCategory,
  isRoadSignCategoryId,
} from "../../../src/features/road-signs/catalog";
import { getSignLearningStatus } from "../../../src/features/road-signs/sign-progress";
import { greenWave, greenWaveAccent } from "../../../src/theme/green-wave";

export default function SignsCategoryScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
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
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 88 + safeBottom },
          ]}
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

        <View style={[styles.footer, { paddingBottom: greenWave.spacing.lg + safeBottom }]}>
          <Pressable
            accessibilityRole="button"
            onPress={openCategoryTest}
            style={({ pressed }) => [
              styles.trainButton,
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: greenWave.spacing.xl,
  },
  list: {
    gap: greenWave.spacing.md,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: greenWave.spacing.xl,
    paddingTop: greenWave.spacing.md,
    backgroundColor: "transparent",
  },
  trainButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: greenWave.spacing.md,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWaveAccent.green.fill,
  },
  trainButtonLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: greenWave.color.onAccent,
  },
  pressed: {
    opacity: 0.92,
  },
});
