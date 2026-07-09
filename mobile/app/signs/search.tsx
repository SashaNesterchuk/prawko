import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { SignListItem } from "../../src/components/shell/SignListItem";
import { SignSearchField } from "../../src/components/shell/SignSearchField";
import { SignsScreenHeader } from "../../src/components/shell/SignsScreenHeader";
import {
  ROAD_SIGN_CATEGORIES,
  searchRoadSigns,
} from "../../src/features/road-signs/catalog";
import { greenWave } from "../../src/theme/green-wave";

export default function SignsSearchScreen() {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
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
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 24 + safeBottom },
          ]}
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
                      router.push({
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  searchWrap: {
    paddingHorizontal: greenWave.spacing.xl,
    paddingBottom: greenWave.spacing.md,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: greenWave.spacing.xl,
    gap: greenWave.spacing.lg,
  },
  section: {
    gap: greenWave.spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  resultList: {
    gap: greenWave.spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: greenWave.spacing.xl,
    paddingHorizontal: greenWave.spacing.lg,
  },
  emptyTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.48,
    color: greenWave.color.ink,
    textAlign: "center",
  },
  emptyDescription: {
    marginTop: greenWave.spacing.md,
    fontSize: 16,
    lineHeight: 24,
    color: greenWave.color.inkSecondary,
    textAlign: "center",
  },
  hintState: {
    paddingTop: greenWave.spacing.lg,
  },
  hintTitle: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "600",
    color: greenWave.color.ink,
  },
  hintDescription: {
    marginTop: greenWave.spacing.sm,
    fontSize: 14,
    lineHeight: 22,
    color: greenWave.color.inkMuted,
  },
});
