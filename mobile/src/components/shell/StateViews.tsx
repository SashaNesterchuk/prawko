import { ActivityIndicator, View } from "react-native";

import { CText, useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type StateViewProps = {
  title: string;
  description: string;
};

export function StateView({ title, description }: StateViewProps) {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.base}>
      <CText style={styles.title}>{title}</CText>
      <CText style={styles.description}>{description}</CText>
    </View>
  );
}

export function LoadingStateView({ title, description }: StateViewProps) {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.base}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
      <CText style={styles.title}>{title}</CText>
      <CText style={styles.description}>{description}</CText>
    </View>
  );
}

export function EmptyStateView({ title, description }: StateViewProps) {
  return <StateView title={title} description={description} />;
}

export function ErrorStateView({ title, description }: StateViewProps) {
  return <StateView title={title} description={description} />;
}

function useStyles() {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    base: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.exact(10),
      paddingHorizontal: spacing.exact(20),
    },
    title: {
      fontSize: responsiveFont(22),
      lineHeight: responsiveFont(28),
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },
    description: {
      fontSize: responsiveFont(15),
      lineHeight: responsiveFont(24),
      color: colors.textSecondary,
      textAlign: "center",
    },
  }));
}
