import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../providers/ThemeProvider";

type StateViewProps = {
  title: string;
  description: string;
};

export function StateView({ title, description }: StateViewProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.base}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

export function LoadingStateView({ title, description }: StateViewProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.base}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

export function EmptyStateView({ title, description }: StateViewProps) {
  return <StateView title={title} description={description} />;
}

export function ErrorStateView({ title, description }: StateViewProps) {
  return <StateView title={title} description={description} />;
}

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    base: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 20,
    },
    title: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "800",
      color: theme.colors.textPrimary,
      textAlign: "center",
    },
    description: {
      fontSize: 15,
      lineHeight: 24,
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
  });
