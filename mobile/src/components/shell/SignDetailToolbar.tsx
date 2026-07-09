import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { greenWave } from "../../theme/green-wave";

type SignDetailToolbarProps = {
  code: string;
  categoryLabel: string;
  currentIndex: number;
  totalCount: number;
  onClose?: () => void;
  closeLabel?: string;
  rightSlot?: ReactNode;
};

export function SignDetailToolbar({
  code,
  categoryLabel,
  currentIndex,
  totalCount,
  onClose,
  closeLabel = "Close",
  rightSlot,
}: SignDetailToolbarProps) {
  return (
    <View style={styles.header}>
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
        >
          <Ionicons color={greenWave.color.ink} name="close" size={22} />
        </Pressable>
      ) : (
        <View style={styles.iconSpacer} />
      )}

      <View style={styles.titleBlock}>
        <Text style={styles.code}>{code}</Text>
        <Text style={styles.category} numberOfLines={1}>
          {categoryLabel}
        </Text>
      </View>

      <View style={styles.metaBlock}>
        <Text style={styles.counter}>{`${currentIndex + 1} / ${totalCount}`}</Text>
        {rightSlot ?? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
          >
            <Ionicons color={greenWave.color.ink} name="bookmark-outline" size={20} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
    paddingHorizontal: greenWave.spacing.lg,
    paddingTop: greenWave.spacing.sm,
    paddingBottom: greenWave.spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.md,
    backgroundColor: greenWave.color.surface,
  },
  iconSpacer: {
    width: 40,
    height: 40,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  code: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    color: greenWave.color.ink,
  },
  category: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
  metaBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
  },
  counter: {
    fontSize: 12,
    lineHeight: 16,
    color: greenWave.color.inkMuted,
  },
  pressed: {
    opacity: 0.9,
  },
});
