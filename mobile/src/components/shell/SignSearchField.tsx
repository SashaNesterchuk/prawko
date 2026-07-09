import { Ionicons } from "@expo/vector-icons";
import { Pressable, TextInput, View } from "react-native";

import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type SignSearchFieldProps = {
  value: string;
  placeholder: string;
  autoFocus?: boolean;
  onChangeText?: (value: string) => void;
  onPress?: () => void;
  onClear?: () => void;
};

export function SignSearchField({
  value,
  placeholder,
  autoFocus = false,
  onChangeText,
  onPress,
  onClear,
}: SignSearchFieldProps) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();
  const editable = !onPress;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={styles.wrapper}
    >
      <View style={styles.field}>
        <Ionicons
          color={theme.colors.inkMuted}
          name="search-outline"
          size={responsiveFont(20)}
        />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          editable={editable}
          pointerEvents={editable ? "auto" : "none"}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.inkMuted}
          style={styles.input}
          value={value}
          onChangeText={onChangeText ?? (() => {})}
        />
        {value.length > 0 && onClear ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Wyczyść"
            hitSlop={8}
            onPress={onClear}
            style={({ pressed }) => [styles.clearButton, pressed ? styles.pressed : null]}
          >
            <Ionicons
              color={theme.colors.inkMuted}
              name="close-circle"
              size={responsiveFont(18)}
            />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    wrapper: {
      width: "100%",
    },
    field: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: spacing.exact(52),
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(6),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 1,
    },
    input: {
      flex: 1,
      paddingVertical: spacing.sm,
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      color: colors.ink,
    },
    clearButton: {
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      opacity: 0.85,
    },
  }));
}
