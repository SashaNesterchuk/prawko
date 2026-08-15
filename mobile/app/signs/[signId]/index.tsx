import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../../src/components/shell/GreenWaveScreen";
import { SignDescriptionWithPlates } from "../../../src/components/shell/SignDescriptionWithPlates";
import { SignDetailNav } from "../../../src/components/shell/SignDetailNav";
import { SignDetailToolbar } from "../../../src/components/shell/SignDetailToolbar";
import { SignStatusBadge } from "../../../src/components/shell/SignStatusBadge";
import {
  CText,
  getFontFamily,
  useResponsiveSpacing,
  useResponsiveStyles,
} from "../../../src/portable-ui";
import {
  getRoadSignById,
  getRoadSignCategory,
  getRoadSignsByCategory,
} from "../../../src/features/road-signs/catalog";
import {
  getSignDescription,
  getSignDisplayName,
} from "../../../src/features/road-signs/content/registry";
import { SignImage } from "../../../src/features/road-signs/SignImage";
import { getSignLearningStatus } from "../../../src/features/road-signs/sign-progress";
import { useSignBookmarksStore } from "../../../src/state/sign-bookmarks";
import { useSignPracticeProgressStore } from "../../../src/state/sign-practice-progress";
import { ANALYTICS_EVENTS } from "../../../src/analytics/catalog";
import { useAnalytics } from "../../../src/providers/AnalyticsProvider";

export default function SignDetailScreen() {
  const { t, i18n } = useTranslation();
  const { track } = useAnalytics();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const spacing = useResponsiveSpacing();
  const styles = useStyles({ safeBottom });
  const { signId } = useLocalSearchParams<{ signId: string }>();
  const sign = useMemo(
    () => (signId ? getRoadSignById(signId) : undefined),
    [signId]
  );
  const category = useMemo(
    () => (sign ? getRoadSignCategory(sign.categoryId) : undefined),
    [sign]
  );

  const categorySigns = useMemo(
    () => (sign ? getRoadSignsByCategory(sign.categoryId) : []),
    [sign]
  );
  const signPracticeRecords = useSignPracticeProgressStore(
    (state) => state.records
  );
  const isBookmarked = useSignBookmarksStore((state) =>
    signId ? Boolean(state.savedSignIds[signId]) : false
  );
  const toggleSaved = useSignBookmarksStore((state) => state.toggleSaved);

  const currentIndex = useMemo(
    () => categorySigns.findIndex((item) => item.id === sign?.id),
    [categorySigns, sign]
  );

  const displayName = sign
    ? getSignDisplayName(sign.id, i18n.language, sign.code)
    : "";
  const description = sign
    ? getSignDescription(sign.id, i18n.language) ??
      t("signs.descriptionBody", {
        category: category
          ? t(`signs.categories.${category.id}.title`)
          : "",
        code: sign.code,
      })
    : "";

  const learningStatus = sign
    ? getSignLearningStatus(sign.id, signPracticeRecords)
    : "new";
  const statusLabel =
    learningStatus === "mastered"
      ? t("signs.statusMastered")
      : learningStatus === "wrong"
        ? t("signs.statusWrong")
        : t("signs.statusNew");

  useEffect(() => {
    if (!sign) {
      return;
    }

    track(ANALYTICS_EVENTS.signOpened.key, {
      category_id: sign.categoryId,
      sign_id: sign.id,
      source: "detail",
    });
  }, [sign, track]);

  const goToSignAt = (index: number) => {
    const target = categorySigns[index];

    if (!target) {
      return;
    }

    router.replace({
      pathname: "/signs/[signId]",
      params: { signId: target.id },
    });
  };

  if (!sign) {
    return (
      <GreenWaveScreen>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <StatusBar style="dark" />
          <View style={styles.missingState}>
            <CText style={styles.missingTitle}>
              {t("signs.notFoundTitle")}
            </CText>
          </View>
        </SafeAreaView>
      </GreenWaveScreen>
    );
  }

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex >= 0 && currentIndex < categorySigns.length - 1;

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />
        <SignDetailToolbar
          code={sign.code}
          categoryLabel={
            category ? t(`signs.categories.${category.id}.title`) : ""
          }
          currentIndex={Math.max(currentIndex, 0)}
          totalCount={categorySigns.length}
          isBookmarked={isBookmarked}
          bookmarkLabel={
            isBookmarked ? t("signs.removeBookmark") : t("signs.bookmark")
          }
          onToggleBookmark={() => {
            const isBookmarkedNext = toggleSaved(sign.id);
            track(ANALYTICS_EVENTS.questionBookmarkChanged.key, {
              is_bookmarked: isBookmarkedNext,
              question_id: sign.id,
              source: "sign_detail",
            });
          }}
          closeLabel={t("common.close", { defaultValue: "Close" })}
          onClose={() => router.back()}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.imageWrap}>
            <SignImage inset={0} sign={sign} size={spacing.exact(160)} />
          </View>

          <View style={styles.descriptionBlock}>
            <SignStatusBadge status={learningStatus} label={statusLabel} />
            <CText style={styles.name}>{displayName}</CText>
            <SignDescriptionWithPlates
              excludeSignId={sign.id}
              text={description}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <SignDetailNav
            backLabel={t("signs.back")}
            forwardLabel={t("signs.forward")}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onBack={() => goToSignAt(currentIndex - 1)}
            onForward={() => goToSignAt(currentIndex + 1)}
          />
        </View>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    safeArea: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.xl,
      paddingTop: 0,
      paddingBottom: spacing.exact(24) + safeBottom,
    },
    imageWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xl,
    },
    descriptionBlock: {
      gap: spacing.sm,
      paddingTop: 0,
      paddingBottom: spacing.exact(32),
    },
    name: {
      marginTop: spacing.sm,
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontFamily: getFontFamily("semiBold"),
      letterSpacing: -0.2,
      color: colors.ink,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xl + safeBottom,
    },
    missingState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },
    missingTitle: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(28),
      fontFamily: getFontFamily("semiBold"),
      color: colors.ink,
      textAlign: "center",
    },
  }));
}
