import type { ReactNode } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";

type ProfileSettingsRowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  icon: ReactNode;
  iconBackground?: string;
  titleColor?: string;
  trailing?: "value" | "switch" | "premium" | "none";
  switchValue?: boolean;
  onPress?: () => void;
  onSwitchChange?: (value: boolean) => void;
  isLast?: boolean;
};

export function ProfileSettingsRow({
  title,
  subtitle,
  value,
  icon,
  iconBackground = greenWave.color.paper,
  titleColor = greenWave.color.ink,
  trailing = "value",
  switchValue = false,
  onPress,
  onSwitchChange,
  isLast = false,
}: ProfileSettingsRowProps) {
  const content = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>
        {icon}
      </View>

      <View style={styles.copy}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {trailing === "value" && value ? (
        <Text style={styles.value}>{value}</Text>
      ) : null}
      {trailing === "switch" ? (
        <Switch
          accessibilityLabel={title}
          onValueChange={onSwitchChange}
          thumbColor="#ffffff"
          trackColor={{
            false: greenWave.color.track,
            true: greenWaveAccent.green.fill,
          }}
          value={switchValue}
        />
      ) : null}
      {trailing === "premium" ? <PremiumMiniBadge /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          !isLast ? styles.rowBorder : null,
          pressed ? styles.pressed : null,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.row, !isLast ? styles.rowBorder : null]}>{content}</View>
  );
}

type ProfileSettingsGroupProps = {
  children: ReactNode;
};

export function ProfileSettingsGroup({ children }: ProfileSettingsGroupProps) {
  return <View style={styles.group}>{children}</View>;
}

function PremiumMiniBadge() {
  return (
    <View style={styles.badge}>
      <View style={styles.badgeCrown} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    width: "100%",
    borderRadius: greenWave.radius.xl,
    backgroundColor: greenWave.color.surface,
    overflow: "hidden",
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.md,
    padding: greenWave.spacing.lg,
    backgroundColor: greenWave.color.surface,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: greenWave.color.line,
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: greenWave.spacing.sm,
    borderRadius: greenWave.radius.md,
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
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: greenWave.color.inkMuted,
  },
  value: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: greenWaveAccent.blue.ink,
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    padding: greenWave.spacing.xs,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWaveAccent.green.fill,
  },
  badgeCrown: {
    width: 10,
    height: 8,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: "#ffffff",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
});
