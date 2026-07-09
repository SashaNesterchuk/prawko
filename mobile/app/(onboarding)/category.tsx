import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ACTIVE_CATEGORIES, type DrivingCategory } from "@prawko/config";

import { useResponsiveFonts, useResponsiveStyles } from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";

type CategoryIconName = keyof typeof MaterialCommunityIcons.glyphMap;

type CategoryOption = {
  id: string;
  icon: CategoryIconName;
};

const CATEGORIES: CategoryOption[] = [
  { id: "A", icon: "motorbike" },
  { id: "A1", icon: "motorbike" },
  { id: "A2", icon: "motorbike" },
  { id: "AM", icon: "moped" },
  { id: "B", icon: "car" },
  { id: "B1", icon: "car" },
  { id: "C", icon: "truck" },
  { id: "C1", icon: "truck" },
  { id: "D", icon: "bus" },
  { id: "D1", icon: "bus" },
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
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
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
  const badgeIconSize = responsiveFont(26);
  const chipIconSize = responsiveFont(22);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.body}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons
              name="book-open-variant"
              size={badgeIconSize}
              color={accents.amber.fill}
            />
          </View>

          <Text style={styles.title}>{t("onboarding.categoryPickTitle")}</Text>
          <Text style={styles.subtitle}>
            {t("onboarding.categoryPickSubtitle")}
          </Text>

          <View style={styles.grid}>
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
                        setPreferredCategory(option.id as DrivingCategory)
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
                      <MaterialCommunityIcons
                        name={option.icon}
                        size={chipIconSize}
                        color={
                          isSelected
                            ? colors.onAccent
                            : colors.textPrimary
                        }
                      />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
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
  );
}

function useStyles() {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
        backgroundColor: colors.background,
      },
      content: {
        flex: 1,
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(24),
      },
      body: {
        flex: 1,
        paddingTop: spacing.exact(8),
      },
      iconBadge: {
        width: spacing.exact(56),
        height: spacing.exact(56),
        borderRadius: radius.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
      },
      title: {
        marginTop: spacing.exact(32),
        fontSize: responsiveFont(32),
        lineHeight: responsiveFont(38),
        fontWeight: "700",
        letterSpacing: -0.64,
        color: colors.textPrimary,
      },
      subtitle: {
        marginTop: spacing.exact(16),
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        fontWeight: "400",
        color: colors.textSecondary,
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
        paddingHorizontal: spacing.exact(20),
        paddingVertical: spacing.exact(16),
        borderRadius: spacing.exact(12),
        borderWidth: 1.5,
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
        gap: spacing.exact(16),
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
        paddingVertical: spacing.exact(16),
        borderRadius: radius.pill,
        backgroundColor: accents.green.fill,
        shadowColor: colors.shadow,
        shadowOpacity: 0.1,
        shadowRadius: spacing.exact(18),
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
