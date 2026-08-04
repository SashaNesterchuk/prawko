import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../../src/components/shell/GreenWaveScreen";
import { SignCatalogCard } from "../../../src/components/shell/SignCatalogCard";
import {
  QuestionCountDialog,
  resolveQuestionCountDialog,
  type QuestionCountSelection,
} from "../../../src/components/shell/QuestionCountDialog";
import { SignsScreenHeader } from "../../../src/components/shell/SignsScreenHeader";
import {
  useResponsiveStyles,
} from "../../../src/portable-ui";
import {
  getRoadSignCategory,
  getRoadSignsByCategory,
  isRoadSignCategoryId,
} from "../../../src/features/road-signs/catalog";
import { buildCategorySignTestQuestions } from "../../../src/features/road-signs/category-test";
import { getSignLearningStatus } from "../../../src/features/road-signs/sign-progress";
import { useSignBookmarksStore } from "../../../src/state/sign-bookmarks";
import { useSignPracticeProgressStore } from "../../../src/state/sign-practice-progress";

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
  const signPracticeRecords = useSignPracticeProgressStore(
    (state) => state.records
  );
  const savedSignIds = useSignBookmarksStore((state) => state.savedSignIds);
  const toggleSaved = useSignBookmarksStore((state) => state.toggleSaved);
  const availableQuestions = useMemo(
    () => buildCategorySignTestQuestions(resolvedCategoryId),
    [resolvedCategoryId]
  );
  const hasCategoryTestQuestions = availableQuestions.length > 0;
  const [countDialogVisible, setCountDialogVisible] = useState(false);
  const [selectedCount, setSelectedCount] =
    useState<QuestionCountSelection>("all");

  const startCategoryTestWithLimit = (limit: QuestionCountSelection) => {
    router.navigate({
      pathname: "/signs/category/[categoryId]/test",
      params: {
        categoryId: resolvedCategoryId,
        limit: limit === "all" ? "all" : String(limit),
      },
    });
  };

  const openCategoryTest = () => {
    const { shouldShowDialog, defaultCount } = resolveQuestionCountDialog(
      availableQuestions.length
    );

    if (!shouldShowDialog) {
      startCategoryTestWithLimit("all");
      return;
    }

    setSelectedCount(defaultCount);
    setCountDialogVisible(true);
  };

  const startCategoryTest = () => {
    setCountDialogVisible(false);
    startCategoryTestWithLimit(selectedCount);
  };

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
        testID={`screen-signs-category-${resolvedCategoryId}`}
      >
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
                isBookmarked={Boolean(savedSignIds[sign.id])}
                showWrongBadge={
                  getSignLearningStatus(sign.id, signPracticeRecords) === "wrong"
                }
                onToggleBookmark={() => toggleSaved(sign.id)}
                onPress={() =>
                  router.navigate({
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
            testID="signs-train-category"
          >
            <Text style={styles.trainButtonLabel}>{t("signs.trainCategory")}</Text>
          </Pressable>
        </View>

        <QuestionCountDialog
          title={
            category
              ? t(`signs.categories.${category.id}.title`)
              : t("signs.title")
          }
          subtitle={t("signs.chooseQuestionCount")}
          startLabel={t("signs.startTrainingCta")}
          allLabel={t("signs.allQuestions")}
          totalCount={availableQuestions.length}
          selectedCount={selectedCount}
          visible={countDialogVisible}
          onClose={() => setCountDialogVisible(false)}
          onSelectCount={setSelectedCount}
          onStart={startCategoryTest}
        />
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
