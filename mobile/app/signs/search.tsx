import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { SignListItem } from "../../src/components/shell/SignListItem";
import { SignSearchField } from "../../src/components/shell/SignSearchField";
import { SignsScreenHeader } from "../../src/components/shell/SignsScreenHeader";
import {
  useResponsiveSpacing,
  useResponsiveStyles,
} from "../../src/portable-ui";
import {
  ROAD_SIGN_CATEGORIES,
  searchRoadSigns,
} from "../../src/features/road-signs/catalog";

export default function SignsSearchScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const styles = useStyles({ safeBottom });
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchRoadSigns(query), [query]);
  const categoryLabels = useMemo(
    () =>
      Object.fromEntries(
        ROAD_SIGN_CATEGORIES.map((category) => [
          category.id,
          t(`signs.categories.${category.id}.title`),
        ])
      ),
    [t]
  );

  const hasQuery = query.trim().length > 0;
  const showEmptyState = hasQuery && results.length === 0;

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />
        <SignsScreenHeader
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
              <Text style={styles.emptyTitle}>
                {t("signs.searchEmptyTitle")}
              </Text>
              <Text style={styles.emptyDescription}>
                {t("signs.searchEmptyDescription")}
              </Text>
            </View>
          ) : null}

          {hasQuery && results.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t("signs.searchResultsTitle", {
                  count: results.length,
                })}
              </Text>
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
              <Text style={styles.hintTitle}>
                {t("signs.searchHintTitle")}
              </Text>
              <Text style={styles.hintDescription}>
                {t("signs.searchHintDescription")}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

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
      fontWeight: "600",
      letterSpacing: -0.16,
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
      fontWeight: "700",
      letterSpacing: -0.48,
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
      fontWeight: "600",
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
