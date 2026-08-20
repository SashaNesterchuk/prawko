import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { buildAllSignTestQuestions } from "../../src/features/road-signs/category-test";
import { SignTestSessionScreen } from "../../src/features/road-signs/SignTestSessionScreen";
import { withRoadSignsFeature } from "../../src/app-config/with-road-signs-feature";

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

function AllSignsTestScreen() {
  const { t } = useTranslation();
  const { limit } = useLocalSearchParams<{ limit?: string }>();
  const resolvedLimit = parseLimit(
    typeof limit === "string" ? limit : Array.isArray(limit) ? limit[0] : undefined
  );
  const questions = useMemo(
    () => buildAllSignTestQuestions(resolvedLimit),
    [resolvedLimit]
  );

  return (
    <SignTestSessionScreen
      questions={questions}
      title={t("signs.signTestTitle")}
      subtitle={t("signs.title")}
    />
  );
}

export default withRoadSignsFeature(AllSignsTestScreen);
