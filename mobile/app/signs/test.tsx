import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { buildAllSignTestQuestions } from "../../src/features/road-signs/category-test";
import { SignTestSessionScreen } from "../../src/features/road-signs/SignTestSessionScreen";

export default function AllSignsTestScreen() {
  const { t } = useTranslation();
  const questions = useMemo(() => buildAllSignTestQuestions(), []);

  return (
    <SignTestSessionScreen
      questions={questions}
      title={t("signs.signTestTitle")}
      subtitle={t("signs.title")}
    />
  );
}
