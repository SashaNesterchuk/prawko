import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { ANALYTICS_EVENTS } from "../../../analytics/catalog";
import { AppButton } from "../../../components/shell/AppButton";
import { CText, useResponsiveStyles } from "../../../portable-ui";
import { useAnalytics } from "../../../providers/AnalyticsProvider";
import { canOfferRewardedExam, rewardedExamUnlocksLeft } from "./usage";
import { useMonetizationV2Store } from "./store";

type ExamUnlockSheetProps = {
  watchingAd: boolean;
  onDismiss: () => void;
  onUnlockPremium: () => void;
  onWatchAd: () => void;
};

export function ExamUnlockSheet({
  watchingAd,
  onDismiss,
  onUnlockPremium,
  onWatchAd,
}: ExamUnlockSheetProps) {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const styles = useStyles();
  const usage = useMonetizationV2Store((state) => state.usage);
  const unlocksLeft = rewardedExamUnlocksLeft(usage);
  const showReward = canOfferRewardedExam(usage);

  useEffect(() => {
    track(ANALYTICS_EVENTS.premiumGateViewed.key, {
      exams_completed: usage.freeExamUsed ? 1 : 0,
      source: "exam_limit",
    });
  }, [track, usage.freeExamUsed]);

  return (
    <View style={styles.sheet} testID="exam-unlock-sheet">
      <CText semiBold style={styles.title}>
        {t("monetizationV2.examSheetTitle")}
      </CText>
      <CText style={styles.body}>{t("monetizationV2.examSheetBody")}</CText>
      <AppButton
        label={t("monetizationV2.unlockPremium")}
        onPress={onUnlockPremium}
        testID="exam-unlock-premium"
      />
      {showReward ? (
        <>
          <AppButton
            label={watchingAd ? t("states.loadingTitle") : t("monetizationV2.watchAd")}
            onPress={onWatchAd}
            variant="secondary"
            testID="exam-unlock-watch-ad"
          />
          <CText style={styles.meta}>
            {t("monetizationV2.rewardedLeft", { count: unlocksLeft })}
          </CText>
        </>
      ) : null}
      <AppButton
        label={t("common.close")}
        onPress={onDismiss}
        variant="ghost"
        testID="exam-unlock-dismiss"
      />
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, spacing }) => ({
    sheet: {
      gap: spacing.md,
      padding: spacing.lg,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      backgroundColor: colors.surface,
    },
    title: {
      fontSize: 22,
    },
    body: {
      color: colors.textSecondary,
    },
    meta: {
      textAlign: "center",
      color: colors.textSecondary,
    },
  }));
}
