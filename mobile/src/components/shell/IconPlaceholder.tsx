import { View } from "react-native";

import { CText, useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

export function IconPlaceholder({
  color,
  size = 24,
}: {
  color?: string;
  size?: number;
}) {
  const theme = useTheme();
  const styles = useStyles({
    glyphColor: color ?? theme.colors.ink,
    size,
  });

  return (
    <View style={styles.root}>
      <CText style={styles.glyph}>*</CText>
    </View>
  );
}

function useStyles({
  glyphColor,
  size,
}: {
  glyphColor: string;
  size: number;
}) {
  return useResponsiveStyles(() => ({
    root: {
      width: size,
      height: size,
      alignItems: "center",
      justifyContent: "center",
    },
    glyph: {
      color: glyphColor,
      fontSize: Math.round(size * 0.72),
      fontWeight: "700",
      lineHeight: undefined,
    },
  }));
}
