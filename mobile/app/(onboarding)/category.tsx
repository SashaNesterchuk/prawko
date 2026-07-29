import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ACTIVE_CATEGORIES, type DrivingCategory } from "@prawko/config";

import { Icon, type IconName } from "../../src/components/icons";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { NavigationButton } from "../../src/components/shell/NavigationButton";
import {
  getFontFamily,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";

type CategoryOption = {
  id: string;
  icon: IconName;
};

const CATEGORIES: CategoryOption[] = [
  { id: "A", icon: "a" },
  { id: "A1", icon: "a1" },
  { id: "A2", icon: "a2" },
  { id: "AM", icon: "aM" },
  { id: "B", icon: "b" },
  { id: "B1", icon: "b1" },
  { id: "C", icon: "c" },
  { id: "C1", icon: "c1" },
  { id: "D", icon: "d" },
  { id: "D1", icon: "d1" },
];

const ACTIVE_CATEGORY_SET = new Set<string>(ACTIVE_CATEGORIES);

function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2));
  }
  return rows;
}

export default function CategoryScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const { colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const onboardingCompleted = useAppShellStore(
    (state) => state.onboardingCompleted
  );
  const isSettingsMode = modeParam === "settings" || onboardingCompleted;
  const preferredCategory = useAppShellStore(
    (state) => state.preferredCategory
  );
  const completeCategoryStep = useAppShellStore(
    (state) => state.completeCategoryStep
  );
  const setPreferredCategory = useAppShellStore(
    (state) => state.setPreferredCategory
  );

  const rows = chunkPairs(CATEGORIES);
  const badgeIconSize = responsiveFont(24);
  const chipIconSize = responsiveFont(24);

  const handleSelectCategory = (category: DrivingCategory) => {
    setPreferredCategory(category);

    if (isSettingsMode) {
      router.back();
    }
  };

  const categoryGrid = (
    <View style={[styles.grid, isSettingsMode ? styles.settingsGrid : null]}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.gridRow}>
          {row.map((option) => {
            const isActive = ACTIVE_CATEGORY_SET.has(option.id);
            const isSelected = preferredCategory === option.id;

            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !isActive,
                  selected: isSelected,
                }}
                disabled={!isActive}
                onPress={() =>
                  handleSelectCategory(option.id as DrivingCategory)
                }
                style={({ pressed }) => [
                  styles.chip,
                  isSelected ? styles.chipSelected : null,
                  !isActive ? styles.chipLocked : null,
                  pressed && isActive ? styles.chipPressed : null,
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    isSelected ? styles.chipLabelSelected : null,
                  ]}
                >
                  {option.id}
                </Text>
                <Icon
                  name={option.icon}
                  size={chipIconSize}
                  color={isSelected ? colors.onAccent : colors.textPrimary}
                />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );

  if (isSettingsMode) {
    return (
      <GreenWaveScreen>
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <StatusBar style="dark" />
          <View style={styles.topBar}>
            <NavigationButton
              accessibilityLabel={t("common.back")}
              onPress={() => router.back()}
              type="back"
              inset
            />
            <Text style={styles.topBarTitle}>{t("profile.categoryTitle")}</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.settingsContent}
            showsVerticalScrollIndicator={false}
          >
            {categoryGrid}
          </ScrollView>
        </SafeAreaView>
      </GreenWaveScreen>
    );
  }

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          <View style={styles.body}>
            <View style={styles.iconBadge}>
              <Icon name="book" size={badgeIconSize} color={colors.icon} />
            </View>

            <Text style={styles.title}>{t("onboarding.categoryPickTitle")}</Text>

            {categoryGrid}
          </View>

          <View style={styles.footer}>
            <View style={styles.paging}>
              <View style={[styles.dot, styles.dotActive]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                completeCategoryStep();
                router.push("/(onboarding)/exam-schedule");
              }}
              style={({ pressed }) => [
                styles.cta,
                pressed ? styles.ctaPressed : null,
              ]}
            >
              <Text style={styles.ctaLabel}>{t("common.continue")}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles() {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
      },
      topBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
        paddingHorizontal: spacing.exact(20),
        paddingTop: spacing.exact(8),
        paddingBottom: spacing.exact(12),
      },
      topBarTitle: {
        flex: 1,
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("bold"),
        color: colors.textPrimary,
      },
      settingsContent: {
        paddingHorizontal: spacing.exact(20),
        paddingBottom: spacing.exact(32),
      },
      settingsGrid: {
        marginTop: 0,
      },
      content: {
        flex: 1,
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(24),
      },
      body: {
        flex: 1,
      },
      iconBadge: {
        width: spacing.exact(56),
        height: spacing.exact(56),
        borderRadius: spacing.exact(18),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.white,
      },
      title: {
        marginTop: spacing.exact(32),
        fontSize: responsiveFont(32),
        lineHeight: responsiveFont(32),
        fontWeight: "700",
        letterSpacing: -0.64,
        color: colors.textPrimary,
      },
      grid: {
        marginTop: spacing.exact(32),
        gap: spacing.exact(10),
      },
      gridRow: {
        flexDirection: "row",
        gap: spacing.exact(10),
      },
      chip: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.exact(24),
        paddingVertical: spacing.exact(16),
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.surface,
      },
      chipSelected: {
        backgroundColor: accents.green.fill,
        borderColor: accents.green.fill,
      },
      chipLocked: {
        opacity: 0.45,
      },
      chipPressed: {
        opacity: 0.85,
      },
      chipLabel: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "600",
        letterSpacing: -0.16,
        color: colors.textPrimary,
      },
      chipLabelSelected: {
        color: colors.onAccent,
      },
      footer: {
        gap: spacing.exact(20),
      },
      paging: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(7),
        paddingVertical: spacing.exact(12),
      },
      dot: {
        width: spacing.exact(7),
        height: spacing.exact(7),
        borderRadius: spacing.exact(4),
        backgroundColor: colors.line,
      },
      dotActive: {
        width: spacing.exact(22),
        backgroundColor: accents.green.fill,
      },
      cta: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.exact(12),
        paddingHorizontal: spacing.exact(24),
        borderRadius: radius.pill,
        backgroundColor: accents.green.fill,
        shadowColor: colors.shadow,
        shadowOpacity: 0.1,
        shadowRadius: spacing.exact(36),
        shadowOffset: { width: 0, height: spacing.exact(14) },
        elevation: 6,
      },
      ctaPressed: {
        opacity: 0.9,
      },
      ctaLabel: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: colors.onAccent,
      },
    })
  );
}
