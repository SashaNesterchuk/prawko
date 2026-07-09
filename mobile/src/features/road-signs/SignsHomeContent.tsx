import { router } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SignCategoryProgressCard } from "../../components/shell/SignCategoryProgressCard";
import { SignsSummaryCard } from "../../components/shell/SignsSummaryCard";
import { getTopicProgress } from "../questions/question-engine";
import { buildQuestionRouteParams } from "../questions/question-routes";
import { useQuestionCatalogVersion } from "../../state/question-catalog";
import { useQuestionProgressStore } from "../../state/question-progress";
import { greenWave } from "../../theme/green-wave";
import {
  ROAD_SIGN_CATEGORIES,
  getRoadSignsByCategory,
} from "./catalog";
import {
  getAllSignsProgress,
  getCategorySignProgress,
} from "./sign-progress";

const SIGNS_TOPIC = "signs" as const;

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
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );

  const topicProgress = useMemo(
    () => getTopicProgress(SIGNS_TOPIC, questionUserState),
    [questionCatalogVersion, questionUserState]
  );

  const catalogProgress = useMemo(() => getAllSignsProgress(), []);

  const categoryPreviews = useMemo(
    () =>
      ROAD_SIGN_CATEGORIES.map((category) => ({
        category,
        previewSign: getRoadSignsByCategory(category.id)[0],
        progress: getCategorySignProgress(category.id),
      })),
    []
  );

  const openSignsTraining = () =>
    router.push({
      pathname: "/question",
      params: buildQuestionRouteParams({
        mode: "learning",
        topic: SIGNS_TOPIC,
      }),
    });

  const resolvedBottomPadding = bottomPadding ?? 96 + safeBottom;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: resolvedBottomPadding },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <SignsSummaryCard
        title={t("signs.title")}
        readiness={topicProgress.progress}
        seen={topicProgress.seen || catalogProgress.seen}
        total={catalogProgress.total || topicProgress.total}
        totalAnswersLabel={t("signs.totalAnswers")}
        trainAllLabel={t("signs.trainAll")}
        onTrainAll={openSignsTraining}
      />

      <View style={styles.categoryList}>
        {categoryPreviews.map(({ category, previewSign, progress }) => (
          <SignCategoryProgressCard
            key={category.id}
            category={category}
            previewSign={previewSign}
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
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: greenWave.spacing.lg,
    paddingTop: greenWave.spacing.sm,
    gap: greenWave.spacing.sm,
  },
  categoryList: {
    gap: greenWave.spacing.sm,
  },
});
