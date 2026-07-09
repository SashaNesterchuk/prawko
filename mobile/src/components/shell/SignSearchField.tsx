import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { greenWave } from "../../theme/green-wave";

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
  const editable = !onPress;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={styles.wrapper}
    >
      <View style={styles.field}>
        <Ionicons color={greenWave.color.inkMuted} name="search-outline" size={20} />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          editable={editable}
          pointerEvents={editable ? "auto" : "none"}
          placeholder={placeholder}
          placeholderTextColor={greenWave.color.inkMuted}
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
            <Ionicons color={greenWave.color.inkMuted} name="close-circle" size={18} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.sm,
    minHeight: 52,
    paddingHorizontal: greenWave.spacing.lg,
    borderRadius: greenWave.radius.lg,
    backgroundColor: greenWave.color.surface,
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  input: {
    flex: 1,
    paddingVertical: greenWave.spacing.sm,
    fontSize: 16,
    lineHeight: 24,
    color: greenWave.color.ink,
  },
  clearButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
  },
});
