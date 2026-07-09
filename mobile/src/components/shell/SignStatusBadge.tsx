import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

export type SignLearningStatus = "new" | "mastered" | "wrong";

type SignStatusBadgeProps = {
  status: SignLearningStatus;
  label: string;
};

export function SignStatusBadge({ status, label }: SignStatusBadgeProps) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const palette =
    status === "mastered"
      ? theme.accents.green
      : status === "wrong"
        ? theme.accents.red
        : theme.accents.blue;
  const styles = useStyles({
    badgeBackground: palette.soft,
    labelColor: palette.ink,
  });

  const iconName =
    status === "mastered"
      ? "checkmark-circle"
      : status === "wrong"
        ? "close-circle"
        : "document-text-outline";

  return (
    <View style={styles.badge}>
      <Ionicons color={palette.ink} name={iconName} size={responsiveFont(14)} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function useStyles({
  badgeBackground,
  labelColor,
}: {
  badgeBackground?: string;
  labelColor?: string;
} = {}) {
  return useResponsiveStyles(({ radius, responsiveFont, spacing }) => ({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: spacing.exact(6),
      paddingVertical: spacing.exact(6),
      paddingHorizontal: spacing.exact(10),
      borderRadius: radius.pill,
      backgroundColor: badgeBackground,
    },
    label: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "600",
      color: labelColor,
    },
  }));
}
