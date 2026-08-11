import {
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import {
  CText,
  getTypographyStyle,
  useResponsiveStyles,
  withResponsiveFont,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type AppTextInputProps = {
  autoCapitalize?: "none" | "characters" | "sentences" | "words";
  autoComplete?: TextInputProps["autoComplete"];
  autoCorrect?: boolean;
  editable?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  label: string;
  multiline?: boolean;
  numberOfLines?: number;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  textContentType?: TextInputProps["textContentType"];
  value: string;
};

export function AppTextInput({
  autoCapitalize = "sentences",
  autoComplete,
  autoCorrect = false,
  editable = true,
  keyboardType,
  label,
  multiline = false,
  numberOfLines,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  textContentType,
  value,
}: AppTextInputProps) {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.wrapper}>
      <CText style={styles.label}>{label}</CText>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.ink3}
        secureTextEntry={secureTextEntry}
        style={[styles.input, multiline ? styles.multilineInput : null]}
        textContentType={textContentType}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    wrapper: {
      gap: spacing.sm,
    },
    label: {
      ...withResponsiveFont(getTypographyStyle("labelS"), responsiveFont),
      color: colors.ink2,
      textTransform: "uppercase",
    },
    input: {
      minHeight: spacing.exact(56),
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.inset,
      paddingHorizontal: spacing.lg,
      ...withResponsiveFont(getTypographyStyle("bodyM"), responsiveFont),
      color: colors.ink,
    },
    multilineInput: {
      paddingVertical: spacing.md,
      textAlignVertical: "top",
    },
  }));
}
