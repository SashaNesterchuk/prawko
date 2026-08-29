import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { SignListItem } from "../../src/components/shell/SignListItem";
import { SignSearchField } from "../../src/components/shell/SignSearchField";
import { ScreenHeader } from "../../src/components/shell/ScreenHeader";
import {
  CText,
  getFontFamily,
  useResponsiveSpacing,
  useResponsiveStyles,
} from "../../src/portable-ui";
import {
  getRoadSignCategories,
  searchRoadSigns,
} from "../../src/features/road-signs/catalog";
import { ANALYTICS_EVENTS } from "../../src/analytics/catalog";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";
import { withRoadSignsFeature } from "../../src/app-config/with-road-signs-feature";

function SignsSearchScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const styles = useStyles({ safeBottom });
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchRoadSigns(query), [query]);
  const categoryLabels = useMemo(
    () =>
      Object.fromEntries(
        getRoadSignCategories().map((category) => [
          category.id,
          t(`signs.categories.${category.id}.title`),
        ])
      ),
    [t]
  );

  const hasQuery = query.trim().length > 0;
  const showEmptyState = hasQuery && results.length === 0;

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    const timeout = setTimeout(() => {
      track(ANALYTICS_EVENTS.signSearchSubmitted.key, {
        query_length: normalizedQuery.length,
        result_count: results.length,
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [query, results.length, track]);

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />
        <ScreenHeader
          title={t("signs.searchTitle")}
          backLabel={t("common.back")}
          onBack={() => router.back()}
        />

        <View style={styles.searchWrap}>
          <SignSearchField
            autoFocus
            value={query}
            placeholder={t("signs.searchPlaceholder")}
            onChangeText={setQuery}
            onClear={() => setQuery("")}
          />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {showEmptyState ? (
            <View style={styles.emptyState}>
              <CText style={styles.emptyTitle}>
                {t("signs.searchEmptyTitle")}
              </CText>
              <CText style={styles.emptyDescription}>
                {t("signs.searchEmptyDescription")}
              </CText>
            </View>
          ) : null}

          {hasQuery && results.length > 0 ? (
            <View style={styles.section}>
              <CText style={styles.sectionTitle}>
                {t("signs.searchResultsTitle", {
                  count: results.length,
                })}
              </CText>
              <View style={styles.resultList}>
                {results.map((sign) => (
                  <SignListItem
                    key={sign.id}
                    sign={sign}
                    categoryLabel={categoryLabels[sign.categoryId]}
                    onPress={() =>
                      router.navigate({
                        pathname: "/signs/[signId]",
                        params: { signId: sign.id },
                      })
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}

          {!hasQuery ? (
            <View style={styles.hintState}>
              <CText style={styles.hintTitle}>
                {t("signs.searchHintTitle")}
              </CText>
              <CText style={styles.hintDescription}>
                {t("signs.searchHintDescription")}
              </CText>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

export default withRoadSignsFeature(SignsSearchScreen);

function useStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    safeArea: {
      flex: 1,
    },
    searchWrap: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.exact(24) + safeBottom,
      gap: spacing.lg,
    },
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontFamily: getFontFamily("semiBold"),
      color: colors.ink,
    },
    resultList: {
      gap: spacing.sm,
    },
    emptyState: {
      alignItems: "center",
      paddingTop: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    emptyTitle: {
      fontSize: responsiveFont(24),
      lineHeight: responsiveFont(32),
      fontFamily: getFontFamily("bold"),
      color: colors.ink,
      textAlign: "center",
    },
    emptyDescription: {
      marginTop: spacing.md,
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      color: colors.inkSecondary,
      textAlign: "center",
    },
    hintState: {
      paddingTop: spacing.lg,
    },
    hintTitle: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(28),
      fontFamily: getFontFamily("semiBold"),
      color: colors.ink,
    },
    hintDescription: {
      marginTop: spacing.sm,
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
      color: colors.inkMuted,
    },
  }));
}
