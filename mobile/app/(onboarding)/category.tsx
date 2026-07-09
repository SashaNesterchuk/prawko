import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ACTIVE_CATEGORIES, type DrivingCategory } from "@prawko/config";

import { useAppShellStore } from "../../src/state/app-shell";
import { greenWave, greenWaveAccent } from "../../src/theme/green-wave";

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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.body}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons
              name="book-open-variant"
              size={26}
              color={greenWaveAccent.amber.fill}
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
                        size={22}
                        color={
                          isSelected
                            ? greenWave.color.onAccent
                            : greenWave.color.ink
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: greenWave.color.paper,
  },
  content: {
    flex: 1,
    paddingHorizontal: greenWave.spacing.xl,
    paddingBottom: greenWave.spacing.xl,
  },
  body: {
    flex: 1,
    paddingTop: greenWave.spacing.sm,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: greenWave.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: greenWave.color.surface,
  },
  title: {
    marginTop: 32,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -0.64,
    color: greenWave.color.ink,
  },
  subtitle: {
    marginTop: greenWave.spacing.lg,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "400",
    color: greenWave.color.inkSecondary,
  },
  grid: {
    marginTop: 32,
    gap: 10,
  },
  gridRow: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: greenWave.spacing.lg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: greenWave.color.line,
    backgroundColor: greenWave.color.surface,
  },
  chipSelected: {
    backgroundColor: greenWaveAccent.green.fill,
    borderColor: greenWaveAccent.green.fill,
  },
  chipLocked: {
    opacity: 0.45,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  chipLabelSelected: {
    color: greenWave.color.onAccent,
  },
  footer: {
    gap: greenWave.spacing.lg,
  },
  paging: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: greenWave.spacing.md,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: greenWave.color.line,
  },
  dotActive: {
    width: 22,
    backgroundColor: greenWaveAccent.green.fill,
  },
  cta: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: greenWave.spacing.lg,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWaveAccent.green.fill,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaLabel: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: greenWave.color.onAccent,
  },
});
