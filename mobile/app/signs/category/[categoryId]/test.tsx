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
import { withRoadSignsFeature } from "../../../../src/app-config/with-road-signs-feature";

function parseLimit(value?: string): number | "all" | null {
  if (!value) {
    return null;
  }

  if (value === "all") {
    return "all";
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function CategorySignTestScreen() {
  const { t, i18n } = useTranslation();
  const { categoryId, limit } = useLocalSearchParams<{
    categoryId: string;
    limit?: string;
  }>();
  const resolvedCategoryId =
    categoryId && isRoadSignCategoryId(categoryId) ? categoryId : "A";
  const resolvedLimit = parseLimit(
    typeof limit === "string" ? limit : Array.isArray(limit) ? limit[0] : undefined
  );

  const category = useMemo(
    () => getRoadSignCategory(resolvedCategoryId),
    [resolvedCategoryId]
  );

  const questions = useMemo(
    () => buildCategorySignTestQuestions(resolvedCategoryId, resolvedLimit),
    [resolvedCategoryId, resolvedLimit]
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

export default withRoadSignsFeature(CategorySignTestScreen);
