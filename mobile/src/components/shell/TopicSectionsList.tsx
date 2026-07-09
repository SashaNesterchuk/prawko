import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { TopicBlockId } from "@prawko/config";

import { getTopicSections } from "../../features/learn/topic-sections";
import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { type GreenWaveAccent } from "../../theme/green-wave";

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
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const sections = getTopicSections(topicId);
  const accentColor = theme.accents[accent];
  const styles = useStyles({
    indexBackground: accentColor.soft,
    indexColor: accentColor.ink,
  });

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
          <View style={styles.sectionIndex}>
            <Text style={styles.sectionIndexLabel}>
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
            color={theme.colors.inkMuted}
            name="chevron-forward"
            size={responsiveFont(18)}
          />
        </Pressable>
      ))}
    </View>
  );
}

function useStyles({
  indexBackground,
  indexColor,
}: {
  indexBackground?: string;
  indexColor?: string;
} = {}) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    root: {
      gap: spacing.sm,
    },
    sectionTitle: {
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontWeight: "600",
      letterSpacing: -0.2,
      color: colors.ink,
      marginBottom: spacing.xs,
    },
    sectionCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(6),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 1,
    },
    sectionIndex: {
      width: spacing.exact(40),
      height: spacing.exact(40),
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      backgroundColor: indexBackground,
    },
    sectionIndexLabel: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      color: indexColor,
    },
    sectionCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    sectionName: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      letterSpacing: -0.16,
      color: colors.ink,
    },
    sectionHint: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.inkMuted,
    },
    pressed: {
      opacity: 0.9,
    },
  }));
}
