import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  ScrollView,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
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
import type { RoadSign } from "../../../src/features/road-signs/types";
import { useSignBookmarksStore } from "../../../src/state/sign-bookmarks";
import { useSignPracticeProgressStore } from "../../../src/state/sign-practice-progress";
import { ANALYTICS_EVENTS } from "../../../src/analytics/catalog";
import { useAnalytics } from "../../../src/providers/AnalyticsProvider";

export default function SignDetailScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const { width: pageWidth } = useWindowDimensions();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const styles = useStyles({ safeBottom });
  const listRef = useRef<FlatList<RoadSign>>(null);
  const pagedIndexRef = useRef(0);
  const pageWidthRef = useRef(pageWidth);
  const [pagerHeight, setPagerHeight] = useState(0);
  const { signId } = useLocalSearchParams<{ signId: string }>();
  const signIdRef = useRef(signId);
  signIdRef.current = signId;
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
  const isBookmarked = useSignBookmarksStore((state) =>
    signId ? Boolean(state.savedSignIds[signId]) : false
  );
  const toggleSaved = useSignBookmarksStore((state) => state.toggleSaved);

  const currentIndex = useMemo(
    () => categorySigns.findIndex((item) => item.id === sign?.id),
    [categorySigns, sign]
  );

  useEffect(() => {
    if (currentIndex >= 0) {
      pagedIndexRef.current = currentIndex;
    }
  }, [currentIndex]);

  useEffect(() => {
    if (pageWidthRef.current === pageWidth || pagedIndexRef.current < 0) {
      pageWidthRef.current = pageWidth;
      return;
    }

    pageWidthRef.current = pageWidth;
    listRef.current?.scrollToIndex({
      animated: false,
      index: pagedIndexRef.current,
    });
  }, [pageWidth]);

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

  const syncSignAt = useCallback(
    (index: number) => {
      const target = categorySigns[index];

      if (!target) {
        return;
      }

      pagedIndexRef.current = index;

      if (target.id !== signIdRef.current) {
        router.setParams({ signId: target.id });
      }
    },
    [categorySigns]
  );

  const goToSignAt = useCallback(
    (index: number) => {
      if (!categorySigns[index]) {
        return;
      }

      syncSignAt(index);
      listRef.current?.scrollToIndex({ animated: true, index });
    },
    [categorySigns, syncSignAt]
  );

  const handlePageChange = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) {
        return;
      }

      const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      const nextIndex = Math.max(0, Math.min(index, categorySigns.length - 1));
      syncSignAt(nextIndex);
    },
    [categorySigns.length, pageWidth, syncSignAt]
  );

  const handlePagerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setPagerHeight((current) => (current === nextHeight ? current : nextHeight));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: RoadSign }) => (
      <SignDetailPage
        pageHeight={pagerHeight}
        pageWidth={pageWidth}
        safeBottom={safeBottom}
        sign={item}
      />
    ),
    [pagerHeight, pageWidth, safeBottom]
  );

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
  const canGoForward =
    currentIndex >= 0 && currentIndex < categorySigns.length - 1;
  const initialIndex = Math.max(currentIndex, 0);

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top"]}
        testID="screen-sign-detail"
      >
        <StatusBar style="dark" />
        <View style={styles.header}>
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
        </View>

        <FlatList
          ref={listRef}
          data={categorySigns}
          getItemLayout={(_, index) => ({
            index,
            length: pageWidth,
            offset: pageWidth * index,
          })}
          initialNumToRender={3}
          initialScrollIndex={initialIndex > 0 ? initialIndex : undefined}
          keyExtractor={(item) => item.id}
          maxToRenderPerBatch={3}
          onLayout={handlePagerLayout}
          onMomentumScrollEnd={handlePageChange}
          onScrollToIndexFailed={({ index }) => {
            requestAnimationFrame(() => {
              listRef.current?.scrollToIndex({ animated: false, index });
            });
          }}
          pagingEnabled
          removeClippedSubviews={false}
          renderItem={renderItem}
          showsHorizontalScrollIndicator={false}
          style={styles.pager}
          testID="sign-detail-pager"
          windowSize={5}
          horizontal
        />

        <View pointerEvents="box-none" style={styles.footer}>
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

const SignDetailPage = memo(function SignDetailPage({
  pageHeight,
  pageWidth,
  safeBottom,
  sign,
}: {
  pageHeight: number;
  pageWidth: number;
  safeBottom: number;
  sign: RoadSign;
}) {
  const { t, i18n } = useTranslation();
  const spacing = useResponsiveSpacing();
  const styles = usePageStyles({ safeBottom });
  const category = getRoadSignCategory(sign.categoryId);
  const signPracticeRecords = useSignPracticeProgressStore(
    (state) => state.records
  );
  const displayName = getSignDisplayName(sign.id, i18n.language, sign.code);
  const description =
    getSignDescription(sign.id, i18n.language) ??
    t("signs.descriptionBody", {
      category: category ? t(`signs.categories.${category.id}.title`) : "",
      code: sign.code,
    });
  const learningStatus = getSignLearningStatus(sign.id, signPracticeRecords);
  const statusLabel =
    learningStatus === "mastered"
      ? t("signs.statusMastered")
      : learningStatus === "wrong"
        ? t("signs.statusWrong")
        : t("signs.statusNew");

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      directionalLockEnabled
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      style={[
        styles.page,
        { width: pageWidth },
        pageHeight > 0 ? { height: pageHeight } : null,
      ]}
      testID={`sign-detail-page-${sign.id}`}
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
  );
});

function useStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    safeArea: {
      flex: 1,
    },
    header: {
      zIndex: 1,
    },
    pager: {
      flex: 1,
      overflow: "hidden",
    },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg + safeBottom,
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

function usePageStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    page: {
      flexGrow: 1,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: 0,
      paddingBottom: spacing.exact(88) + safeBottom,
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
      color: colors.ink,
    },
  }));
}
