import { useEffect, useRef } from "react";
import { Modal, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ANALYTICS_EVENTS } from "../../../analytics/catalog";
import { AppButton } from "../../../components/shell/AppButton";
import {
  CText,
  getFontFamily,
  useResponsiveStyles,
} from "../../../portable-ui";
import { useAnalytics } from "../../../providers/AnalyticsProvider";

type DiagnosticReminderPromptProps = {
  examDateLabel: string | null;
  onEnable: () => void;
  onLater: () => void;
  visible: boolean;
};

type ReminderResolveAction = "enable" | "later" | "dismiss";

export function DiagnosticReminderPrompt({
  examDateLabel,
  onEnable,
  onLater,
  visible,
}: DiagnosticReminderPromptProps) {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const insets = useSafeAreaInsets();
  const didShowRef = useRef(false);
  const didResolveRef = useRef(false);
  const styles = useStyles(insets.bottom);

  useEffect(() => {
    if (!visible) {
      didShowRef.current = false;
      didResolveRef.current = false;
      return;
    }

    if (didShowRef.current) {
      return;
    }

    didShowRef.current = true;
    track(ANALYTICS_EVENTS.diagnosticReminderShown.key, {
      has_exam_date: Boolean(examDateLabel),
    });
  }, [examDateLabel, track, visible]);

  function trackResolved(action: ReminderResolveAction) {
    if (didResolveRef.current) {
      return;
    }

    didResolveRef.current = true;
    track(ANALYTICS_EVENTS.diagnosticReminderResolved.key, {
      action,
    });
  }

  function handleDismiss() {
    trackResolved("dismiss");
    onLater();
  }

  function handleEnable() {
    trackResolved("enable");
    onEnable();
  }

  function handleLater() {
    trackResolved("later");
    onLater();
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleDismiss}
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          onPress={handleDismiss}
          style={styles.backdrop}
        />
        <View style={styles.sheet} testID="diagnostic-reminder-prompt">
          <View style={styles.handle} />
          <CText style={styles.title}>{t("diagnostic.reminderTitle")}</CText>
          <CText style={styles.body}>{t("diagnostic.reminderBody")}</CText>
          {examDateLabel ? (
            <CText style={styles.examDate}>
              {t("diagnostic.reminderExamDate", { date: examDateLabel })}
            </CText>
          ) : null}
          <AppButton
            label={t("diagnostic.reminderEnable")}
            onPress={handleEnable}
            testID="diagnostic-reminder-enable"
          />
          <Pressable
            accessibilityRole="button"
            onPress={handleLater}
            style={({ pressed }) => [
              styles.later,
              pressed ? styles.laterPressed : null,
            ]}
            testID="diagnostic-reminder-later"
          >
            <CText style={styles.laterLabel}>
              {t("diagnostic.reminderLater")}
            </CText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function useStyles(safeBottom: number) {
  return useResponsiveStyles(
    ({ colors, radius, responsiveFont, spacing }) => ({
      root: {
        flex: 1,
        justifyContent: "flex-end",
      },
      backdrop: {
        backgroundColor: colors.overlayBackdrop,
        bottom: 0,
        left: 0,
        position: "absolute",
        right: 0,
        top: 0,
      },
      sheet: {
        backgroundColor: colors.white,
        borderTopLeftRadius: radius.xxxl,
        borderTopRightRadius: radius.xxxl,
        gap: spacing.exact(12),
        overflow: "hidden",
        paddingBottom: Math.max(safeBottom, spacing.exact(16)),
        paddingHorizontal: spacing.exact(24),
        paddingTop: spacing.exact(10),
      },
      handle: {
        alignSelf: "center",
        backgroundColor: colors.ink3,
        borderRadius: radius.pill,
        height: spacing.exact(5),
        marginBottom: spacing.exact(4),
        width: spacing.exact(40),
      },
      title: {
        fontSize: responsiveFont(22),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("bold"),
        color: colors.ink,
      },
      body: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("regular"),
        color: colors.ink2,
      },
      examDate: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("medium"),
        color: colors.ink,
      },
      later: {
        alignItems: "center",
        paddingVertical: spacing.exact(8),
      },
      laterPressed: {
        opacity: 0.7,
      },
      laterLabel: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("medium"),
        color: colors.ink3,
      },
    })
  );
}
