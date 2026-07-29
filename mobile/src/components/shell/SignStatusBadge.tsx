import { Text, View } from "react-native";

import { Icon, type IconName } from "../icons";
import { useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

export type SignLearningStatus = "new" | "mastered" | "wrong";

type SignStatusBadgeProps = {
  status: SignLearningStatus;
  label: string;
};

export function SignStatusBadge({ status, label }: SignStatusBadgeProps) {
  const theme = useTheme();
  const styles = useStyles();

  const palette =
    status === "mastered"
      ? {
          background: theme.accents.green.soft,
          color: theme.accents.green.ink,
          icon: "check" as IconName,
        }
      : status === "wrong"
        ? {
            background: theme.accents.red.soft,
            color: theme.accents.red.ink,
            icon: "close" as IconName,
          }
        : {
            background: theme.colors.surface2,
            color: theme.colors.ink,
            icon: "document" as IconName,
          };

  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Icon color={palette.color} name={palette.icon} size={16} />
      <Text style={[styles.label, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ radius, responsiveFont, spacing }) => ({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: spacing.exact(4),
      paddingVertical: spacing.exact(4),
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
    },
    label: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
    },
  }));
}
