import { StyleSheet, View } from "react-native";

import { useTheme } from "../../providers/ThemeProvider";

type ProgressBarProps = {
  progress: number;
};

export function ProgressBar({ progress }: ProgressBarProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const normalized = Math.max(0, Math.min(progress, 100));

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${normalized}%` }]} />
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    track: {
      height: 10,
      borderRadius: 999,
      backgroundColor: theme.colors.cardMuted,
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: theme.colors.accent,
    },
  });
