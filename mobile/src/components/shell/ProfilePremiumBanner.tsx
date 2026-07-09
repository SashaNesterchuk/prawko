import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";

type ProfilePremiumBannerProps = {
  title: string;
  description: string;
  onPress?: () => void;
};

export function ProfilePremiumBanner({
  title,
  description,
  onPress,
}: ProfilePremiumBannerProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.banner,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons color="#ffffff" name="diamond" size={24} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: greenWave.spacing.lg,
    paddingTop: greenWave.spacing.lg,
    paddingBottom: greenWave.spacing.md,
    paddingHorizontal: greenWave.spacing.lg,
    borderRadius: greenWave.radius.xl,
    backgroundColor: greenWaveAccent.green.fill,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.92,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: greenWave.spacing.sm,
    borderRadius: greenWave.radius.md,
    backgroundColor: greenWaveAccent.amber.fill,
  },
  copy: {
    flex: 1,
    gap: greenWave.spacing.xs,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.16,
    color: "#ffffff",
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: "rgba(255,255,255,0.8)",
  },
});
