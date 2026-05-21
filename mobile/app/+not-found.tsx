import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { AppButton } from "../src/components/shell/AppButton";
import { AppScreen } from "../src/components/shell/AppScreen";
import { StateView } from "../src/components/shell/StateViews";

export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <AppScreen
      title={t("states.notFoundTitle")}
      subtitle={t("states.notFoundSubtitle")}
      footer={
        <AppButton
          label={t("common.backToHome")}
          onPress={() => router.replace("/")}
        />
      }
    >
      <StateView
        title={t("states.notFoundTitle")}
        description={t("states.notFoundSubtitle")}
      />
    </AppScreen>
  );
}
