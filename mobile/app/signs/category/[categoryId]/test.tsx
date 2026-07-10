import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  getRoadSignCategory,
  isRoadSignCategoryId,
} from "../../../../src/features/road-signs/catalog";
import {
  buildCategorySignTestQuestions,
} from "../../../../src/features/road-signs/category-test";
import { SignTestSessionScreen } from "../../../../src/features/road-signs/SignTestSessionScreen";

export default function CategorySignTestScreen() {
  const { t, i18n } = useTranslation();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const resolvedCategoryId =
    categoryId && isRoadSignCategoryId(categoryId) ? categoryId : "A";

  const category = useMemo(
    () => getRoadSignCategory(resolvedCategoryId),
    [resolvedCategoryId]
  );

  const questions = useMemo(
    () => buildCategorySignTestQuestions(resolvedCategoryId),
    [resolvedCategoryId]
  );

  return (
    <SignTestSessionScreen
      questions={questions}
      title={t("signs.signTestTitle")}
      subtitle={
        category ? t(`signs.categories.${category.id}.title`) : i18n.t("signs.title")
      }
    />
  );
}
