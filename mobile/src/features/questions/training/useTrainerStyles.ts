import { useResponsiveStyles } from "../../../portable-ui";

export function useTrainerStyles({
  feedbackBackgroundColor,
  feedbackTitleColor,
  resultPercentColor,
}: {
  feedbackBackgroundColor: string;
  feedbackTitleColor: string;
  resultPercentColor: string;
}) {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
        backgroundColor: colors.paper,
      },
      footerStack: {
        gap: spacing.exact(10),
      },
      container: {
        flex: 1,
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(24),
      },
      header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(8),
      },
      headerButton: {
        width: spacing.exact(40),
        height: spacing.exact(40),
        alignItems: "center",
        justifyContent: "center",
      },
      headerCenter: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      headerTitle: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: colors.textPrimary,
      },
      headerCounter: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textSecondary,
      },
      stepperScroll: {
        flexGrow: 0,
        marginTop: spacing.exact(12),
      },
      stepper: {
        gap: spacing.exact(4),
        alignItems: "center",
      },
      metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: spacing.exact(24),
        paddingBottom: spacing.exact(8),
      },
      metaText: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textSecondary,
      },
      body: {
        flex: 1,
      },
      bodyContent: {
        paddingBottom: spacing.exact(12),
      },
      mediaBleed: {
        marginHorizontal: -spacing.exact(24),
        marginBottom: spacing.exact(12),
      },
      prompt: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "500",
        letterSpacing: -0.16,
        color: colors.textPrimary,
        marginBottom: spacing.exact(12),
      },
      options: {
        gap: spacing.exact(4),
      },
      booleanOptions: {
        flexDirection: "row",
        gap: spacing.exact(4),
      },
      feedbackCard: {
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        padding: spacing.exact(24),
        marginHorizontal: -spacing.exact(24),
        marginBottom: -spacing.exact(24),
        gap: spacing.exact(12),
        backgroundColor: feedbackBackgroundColor,
      },
      feedbackHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
      },
      feedbackTitle: {
        flex: 1,
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: feedbackTitleColor,
      },
      feedbackBody: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textSecondary,
      },
      masteryProgress: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontWeight: "600",
        color: accents.green.ink,
      },
      explainRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(8),
        paddingVertical: spacing.exact(8),
      },
      explainText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: accents.blue.ink,
      },
      aiBadge: {
        width: spacing.exact(24),
        height: spacing.exact(24),
        borderRadius: radius.pill,
        backgroundColor: accents.green.fill,
        alignItems: "center",
        justifyContent: "center",
      },
      primaryButton: {
        borderRadius: radius.pill,
        paddingHorizontal: spacing.exact(24),
        paddingVertical: spacing.exact(12),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: accents.green.fill,
      },
      primaryButtonText: {
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: colors.onAccent,
      },
      pressed: {
        opacity: 0.9,
      },
      reportButton: {
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.exact(16),
        paddingVertical: spacing.exact(12),
      },
      reportText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: colors.textSecondary,
      },
      resultContainer: {
        flex: 1,
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(24),
      },
      resultHeader: {
        flexDirection: "row",
        alignItems: "center",
      },
      resultBodyArea: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      },
      successBadge: {
        width: spacing.exact(96),
        height: spacing.exact(96),
        borderRadius: radius.pill,
        backgroundColor: colors.paper,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.exact(24),
      },
      resultTitle: {
        fontSize: responsiveFont(32),
        lineHeight: responsiveFont(36),
        fontWeight: "700",
        letterSpacing: -0.64,
        textAlign: "center",
        color: colors.textPrimary,
        marginBottom: spacing.exact(16),
      },
      resultPercent: {
        fontSize: responsiveFont(52),
        lineHeight: responsiveFont(54),
        fontWeight: "700",
        letterSpacing: -0.52,
        textAlign: "center",
        marginBottom: spacing.exact(12),
        color: resultPercentColor,
      },
      resultCount: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        textAlign: "center",
        color: colors.textSecondary,
        marginBottom: spacing.exact(16),
      },
      resultBody: {
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(28),
        textAlign: "center",
        color: colors.textSecondary,
        marginBottom: spacing.exact(24),
      },
      nextCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
        padding: spacing.exact(16),
        borderRadius: radius.xl,
        backgroundColor: colors.surface,
        alignSelf: "stretch",
      },
      nextIconBox: {
        padding: spacing.exact(8),
        borderRadius: radius.md,
        backgroundColor: colors.paper,
      },
      nextCardText: {
        flex: 1,
      },
      nextTitle: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontWeight: "600",
        letterSpacing: -0.16,
        color: colors.textPrimary,
      },
      nextSubtitle: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textMuted,
      },
    })
  );
}
