import { PropsWithChildren, ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { getFontFamily, useResponsiveStyles } from "../../portable-ui";

type AppScreenProps = PropsWithChildren<{
  title?: string;
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
  const styles = useStyles();

  const hasHeader = Boolean(title || subtitle);

  const content = (
    <View style={styles.inner}>
      {hasHeader ? (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
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

function useStyles() {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flexContent: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing.exact(24),
    },
    inner: {
      paddingHorizontal: spacing.exact(20),
      paddingTop: spacing.exact(20),
    },
    header: {
      marginBottom: spacing.exact(18),
      gap: spacing.exact(8),
    },
    title: {
      fontSize: responsiveFont(32),
      lineHeight: responsiveFont(38),
      fontFamily: getFontFamily("bold"),
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontFamily: getFontFamily("regular"),
      color: colors.textSecondary,
    },
    content: {
      gap: spacing.exact(16),
      paddingBottom: spacing.exact(12),
    },
    footer: {
      paddingHorizontal: spacing.exact(20),
      paddingTop: spacing.exact(12),
      paddingBottom: spacing.exact(16),
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.borderSoft,
    },
  }));
}
