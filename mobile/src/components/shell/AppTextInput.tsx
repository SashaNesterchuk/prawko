import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

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
  const styles = getStyles(theme);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        secureTextEntry={secureTextEntry}
        style={[styles.input, multiline ? styles.multilineInput : null]}
        textContentType={textContentType}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrapper: {
      gap: 8,
    },
    label: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
    },
    input: {
      minHeight: 56,
      borderRadius: theme.radius.large,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 16,
      fontSize: 16,
      color: theme.colors.textPrimary,
    },
    multilineInput: {
      paddingVertical: 14,
      textAlignVertical: "top",
    },
  });
