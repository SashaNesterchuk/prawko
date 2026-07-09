import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { TopicBlockId } from "@prawko/config";

import { getTopicSections } from "../../features/learn/topic-sections";
import { greenWave, greenWaveAccent, type GreenWaveAccent } from "../../theme/green-wave";

type TopicSectionsListProps = {
  topicId: TopicBlockId;
  accent?: GreenWaveAccent;
  onSectionPress: (sectionIndex: number) => void;
};

export function TopicSectionsList({
  topicId,
  accent = "green",
  onSectionPress,
}: TopicSectionsListProps) {
  const { t } = useTranslation();
  const sections = getTopicSections(topicId);
  const accentColor = greenWaveAccent[accent];

  return (
    <View style={styles.root}>
      <Text style={styles.sectionTitle}>
        {t("learn.topicSectionsTitle", { defaultValue: "Розділи" })}
      </Text>

      {sections.map((section, index) => (
        <Pressable
          key={section}
          accessibilityRole="button"
          onPress={() => onSectionPress(index)}
          style={({ pressed }) => [styles.sectionCard, pressed ? styles.pressed : null]}
        >
          <View style={[styles.sectionIndex, { backgroundColor: accentColor.soft }]}>
            <Text style={[styles.sectionIndexLabel, { color: accentColor.ink }]}>
              {index + 1}
            </Text>
          </View>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionName}>{section}</Text>
            <Text style={styles.sectionHint}>
              {t("learn.topicSectionHint", {
                defaultValue: "Почати розділ",
              })}
            </Text>
          </View>
          <Ionicons
            color={greenWave.color.inkMuted}
            name="chevron-forward"
            size={18}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: greenWave.spacing.sm,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: greenWave.color.ink,
    marginBottom: greenWave.spacing.xs,
  },
  sectionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.md,
    padding: greenWave.spacing.lg,
    borderRadius: greenWave.radius.lg,
    backgroundColor: greenWave.color.surface,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionIndex: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.md,
  },
  sectionIndexLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  sectionCopy: {
    flex: 1,
    gap: greenWave.spacing.xs,
  },
  sectionName: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: greenWave.color.ink,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
  pressed: {
    opacity: 0.9,
  },
});
