import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { greenWave } from "../../theme/green-wave";

type SignsScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  rightSlot?: ReactNode;
};

export function SignsScreenHeader({
  title,
  onBack,
  backLabel = "Назад",
  rightSlot,
}: SignsScreenHeaderProps) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
        >
          <Ionicons color={greenWave.color.ink} name="chevron-back" size={22} />
        </Pressable>
      ) : (
        <View style={styles.backSpacer} />
      )}

      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>

      {rightSlot ?? <View style={styles.backSpacer} />}
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
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: greenWave.radius.md,
    backgroundColor: greenWave.color.surface,
  },
  backSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.48,
    color: greenWave.color.ink,
  },
  pressed: {
    opacity: 0.9,
  },
});
