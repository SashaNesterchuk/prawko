import { PropsWithChildren, ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { CText, getFontFamily, useResponsiveStyles } from "../../portable-ui";
import { GreenWaveScreen } from "./GreenWaveScreen";
import { NavigationButton } from "./NavigationButton";

type AppScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  scroll?: boolean;
  testID?: string;
  onClose?: () => void;
  closeAccessibilityLabel?: string;
  closeTestID?: string;
}>;

export function AppScreen({
  children,
  closeAccessibilityLabel,
  closeTestID,
  footer,
  onClose,
  scroll = true,
  subtitle,
  testID,
  title,
}: AppScreenProps) {
  const styles = useStyles();

  const hasHeader = Boolean(title || subtitle || onClose);
  const hasInlineTitle = Boolean(onClose && title);

  const content = (
    <View style={styles.inner}>
      {hasHeader ? (
        <View style={styles.header}>
          {onClose ? (
            <View style={hasInlineTitle ? styles.titleRow : styles.toolbar}>
              <NavigationButton
                accessibilityLabel={closeAccessibilityLabel ?? "Close"}
                inset
                onPress={onClose}
                testID={closeTestID}
                type="close"
              />
              {hasInlineTitle ? (
                <CText style={styles.inlineTitle}>{title}</CText>
              ) : null}
            </View>
          ) : null}
          {!hasInlineTitle && title ? (
            <CText style={styles.title}>{title}</CText>
          ) : null}
          {subtitle ? <CText style={styles.subtitle}>{subtitle}</CText> : null}
        </View>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );

  return (
    <GreenWaveScreen>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
        testID={testID}
      >
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
    </GreenWaveScreen>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    safeArea: {
      flex: 1,
    },
    flexContent: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing.exact(24),
    },
    inner: {
      paddingHorizontal: spacing.exact(20),
      paddingTop: spacing.exact(12),
    },
    header: {
      marginBottom: spacing.exact(18),
      gap: spacing.exact(8),
    },
    toolbar: {
      marginBottom: spacing.exact(4),
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(16),
    },
    inlineTitle: {
      flex: 1,
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontFamily: getFontFamily("semiBold"),
      letterSpacing: -0.2,
      color: colors.textPrimary,
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
    },
  }));
}
