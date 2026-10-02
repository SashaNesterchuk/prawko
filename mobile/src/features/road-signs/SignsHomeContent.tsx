import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SignCategoryProgressCard } from "../../components/shell/SignCategoryProgressCard";
import {
  QuestionCountDialog,
  resolveQuestionCountDialog,
  type QuestionCountSelection,
} from "../../components/shell/QuestionCountDialog";
import { SignsSummaryCard } from "../../components/shell/SignsSummaryCard";
import type { AnalyticsProperties } from "../../analytics/catalog";
import { withLearningIntent } from "../../analytics/operations";
import {
  useResponsiveSpacing,
  useResponsiveStyles,
} from "../../portable-ui";
import { useSignPracticeProgressStore } from "../../state/sign-practice-progress";
import {
  getRoadSignCategories,
} from "./catalog";
import { buildAllSignTestQuestions } from "./category-test";
import {
  getAllSignsProgress,
  getCategorySignProgress,
} from "./sign-progress";

type SignsHomeContentProps = {
  showBackButton?: boolean;
  onBack?: () => void;
  bottomPadding?: number;
};

export function SignsHomeContent({
  bottomPadding,
}: SignsHomeContentProps) {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const spacing = useResponsiveSpacing();
  const signPracticeRecords = useSignPracticeProgressStore(
    (state) => state.records
  );
  const availableQuestions = useMemo(() => buildAllSignTestQuestions(), []);
  const [countDialogVisible, setCountDialogVisible] = useState(false);
  const [selectedCount, setSelectedCount] =
    useState<QuestionCountSelection>("all");

  const catalogProgress = useMemo(
    () => getAllSignsProgress(signPracticeRecords),
    [signPracticeRecords]
  );
  const readiness = useMemo(
    () =>
      catalogProgress.total > 0
        ? (catalogProgress.seen / catalogProgress.total) * 100
        : 0,
    [catalogProgress.seen, catalogProgress.total]
  );

  const categoryPreviews = useMemo(
    () =>
      getRoadSignCategories().map((category) => ({
        category,
        progress: getCategorySignProgress(category.id, signPracticeRecords),
      })),
    [signPracticeRecords]
  );

  const startSignsTrainingWithLimit = (limit: QuestionCountSelection, setup?: AnalyticsProperties) => {
    router.navigate({
      pathname: "/signs/test",
      params: withLearningIntent({
        limit: limit === "all" ? "all" : String(limit),
      }, {
        feature: "sign_test", sign_test_entry: "signs_home", target_screen: "sign_test",
        setup_id: setup?.setup_id ?? null, question_limit: limit === "all" ? null : limit,
      }),
    });
  };

  const openSignsTraining = () => {
    const { shouldShowDialog, defaultCount } = resolveQuestionCountDialog(
      availableQuestions.length
    );

    if (!shouldShowDialog) {
      startSignsTrainingWithLimit("all");
      return;
    }

    setSelectedCount(defaultCount);
    setCountDialogVisible(true);
  };

  const startSignsTraining = (setup?: AnalyticsProperties) => {
    setCountDialogVisible(false);
    startSignsTrainingWithLimit(selectedCount, setup);
  };

  const resolvedBottomPadding = bottomPadding ?? spacing.exact(96) + safeBottom;
  const styles = useStyles({ contentBottomPadding: resolvedBottomPadding });

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SignsSummaryCard
          title={t("signs.title")}
          progress={readiness}
          correct={catalogProgress.correct}
          wrong={catalogProgress.wrong}
          seen={catalogProgress.seen}
          total={catalogProgress.total}
          answersLabel={t("signs.totalAnswers")}
          trainAllLabel={t("signs.trainAll")}
          onTrainAll={openSignsTraining}
          variant="learned"
        />

        <View style={styles.categoryList}>
          {categoryPreviews.map(({ category, progress }) => (
            <SignCategoryProgressCard
              key={category.id}
              category={category}
              progress={progress}
              title={t(`signs.categories.${category.id}.title`)}
              variant="learned"
              onPress={() =>
                router.navigate({
                  pathname: "/signs/category/[categoryId]",
                  params: { categoryId: category.id },
                })
              }
            />
          ))}
        </View>
      </ScrollView>

      <QuestionCountDialog
        analyticsContext={{ feature: "sign_test", sign_test_entry: "signs_home" }}
        title={t("signs.title")}
        subtitle={t("signs.chooseQuestionCount")}
        startLabel={t("signs.startTrainingCta")}
        allLabel={t("signs.allQuestions")}
        totalCount={availableQuestions.length}
        selectedCount={selectedCount}
        visible={countDialogVisible}
        onClose={() => setCountDialogVisible(false)}
        onSelectCount={setSelectedCount}
        onStart={startSignsTraining}
      />
    </>
  );
}

function useStyles({
  contentBottomPadding,
}: {
  contentBottomPadding: number;
}) {
  return useResponsiveStyles(({ spacing }) => ({
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.exact(24),
      paddingTop: spacing.exact(12),
      paddingBottom: contentBottomPadding,
      gap: spacing.xxl,
    },
    categoryList: {
      gap: spacing.sm,
    },
  }));
}
