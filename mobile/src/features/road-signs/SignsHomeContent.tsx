import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SignCategoryProgressCard } from "../../components/shell/SignCategoryProgressCard";
import { QuestionCountDialog } from "../../components/shell/QuestionCountDialog";
import { SignsSummaryCard } from "../../components/shell/SignsSummaryCard";
import {
  useResponsiveSpacing,
  useResponsiveStyles,
} from "../../portable-ui";
import { useSignPracticeProgressStore } from "../../state/sign-practice-progress";
import {
  ROAD_SIGN_CATEGORIES,
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
  const [selectedCount, setSelectedCount] = useState<number | "all">(20);

  const catalogProgress = useMemo(
    () => getAllSignsProgress(signPracticeRecords),
    [signPracticeRecords]
  );
  const readiness = useMemo(
    () =>
      catalogProgress.total > 0
        ? (catalogProgress.correct / catalogProgress.total) * 100
        : 0,
    [catalogProgress.correct, catalogProgress.total]
  );

  const categoryPreviews = useMemo(
    () =>
      ROAD_SIGN_CATEGORIES.map((category) => ({
        category,
        progress: getCategorySignProgress(category.id, signPracticeRecords),
      })),
    [signPracticeRecords]
  );

  const openSignsTraining = () => {
    setSelectedCount(availableQuestions.length >= 20 ? 20 : "all");
    setCountDialogVisible(true);
  };

  const startSignsTraining = () => {
    setCountDialogVisible(false);
    router.push({
      pathname: "/signs/test",
      params: {
        limit: selectedCount === "all" ? "all" : String(selectedCount),
      },
    });
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
          seen={catalogProgress.seen}
          total={catalogProgress.total}
          totalAnswersLabel={t("signs.totalAnswers")}
          trainAllLabel={t("signs.trainAll")}
          onTrainAll={openSignsTraining}
        />

        <View style={styles.categoryList}>
          {categoryPreviews.map(({ category, progress }) => (
            <SignCategoryProgressCard
              key={category.id}
              category={category}
              progress={progress}
              title={t(`signs.categories.${category.id}.title`)}
              onPress={() =>
                router.push({
                  pathname: "/signs/category/[categoryId]",
                  params: { categoryId: category.id },
                })
              }
            />
          ))}
        </View>
      </ScrollView>

      <QuestionCountDialog
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
      paddingLeft: spacing.lg,
      paddingRight: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: contentBottomPadding,
      gap: spacing.sm,
    },
    categoryList: {
      gap: spacing.sm,
    },
  }));
}
