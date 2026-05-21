import { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useTheme } from "../../providers/ThemeProvider";

type AppScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  scroll?: boolean;
}>;

export function AppScreen({
  children,
  footer,
  scroll = true,
  subtitle,
  title,
}: AppScreenProps) {
  const theme = useTheme();
  const styles = getStyles(theme);

  const content = (
    <View style={styles.inner}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={styles.flexContent}>{content}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    flexContent: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 24,
    },
    inner: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    header: {
      marginBottom: 18,
      gap: 8,
    },
    title: {
      fontSize: 32,
      lineHeight: 38,
      fontWeight: "800",
      color: theme.colors.textPrimary,
    },
    subtitle: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.colors.textSecondary,
    },
    content: {
      gap: 16,
      paddingBottom: 12,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
      backgroundColor: theme.colors.background,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderSoft,
    },
  });
