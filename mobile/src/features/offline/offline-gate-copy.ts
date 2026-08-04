import type { TFunction } from "i18next";

import type { OfflinePackBlockedReason } from "./offline-pack";

export function getOfflineGateDescription({
  currentCategory,
  downloadedCategory,
  reason,
  t,
  type,
}: {
  currentCategory: string;
  downloadedCategory: string | null;
  reason: OfflinePackBlockedReason;
  t: TFunction;
  type: "exam" | "training";
}) {
  if (reason === "pack_for_other_category" && downloadedCategory) {
    return t("offlineGate.otherCategoryBody", {
      currentCategory,
      downloadedCategory,
      feature: t(`offlineGate.features.${type}`),
    });
  }

  if (reason === "download_incomplete") {
    return t("offlineGate.incompleteBody", {
      category: currentCategory,
      feature: t(`offlineGate.features.${type}`),
    });
  }

  return t(`offlineGate.${type}Body`, {
    category: currentCategory,
  });
}
