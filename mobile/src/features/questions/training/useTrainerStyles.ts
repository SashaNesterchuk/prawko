import { getFontFamily, useResponsiveStyles } from "../../../portable-ui";

export function useTrainerStyles({
  feedbackTitleColor,
  resultPercentColor,
}: {
  feedbackTitleColor: string;
  resultPercentColor: string;
}) {
  return useResponsiveStyles(
    ({ accents, colors, elevation, radius, responsiveFont, spacing }) => ({
      safeArea: {
        flex: 1,
      },
      footerStack: {
        gap: spacing.exact(10),
      },
      container: {
        flex: 1,
      },
      contentPad: {
        paddingHorizontal: spacing.exact(24),
      },
      header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(16),
      },
      headerCenter: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      headerTitle: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textPrimary,
      },
      headerCounter: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textSecondary,
        fontVariant: ["tabular-nums"],
      },
      headerCounterUrgent: {
        color: accents.red.ink,
      },
      stepperScroll: {
        flexGrow: 0,
        marginTop: spacing.exact(12),
      },
      stepper: {
        gap: spacing.exact(4),
        alignItems: "center",
        paddingHorizontal: spacing.exact(24),
      },
      metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.exact(24),
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
      mediaBleed: {
        width: "100%",
        marginBottom: spacing.exact(12),
      },
      prompt: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        fontFamily: getFontFamily("medium"),
        color: colors.textPrimary,
        marginBottom: spacing.exact(12),
        paddingHorizontal: spacing.exact(24),
      },
      options: {
        gap: spacing.exact(4),
        paddingHorizontal: spacing.exact(24),
      },
      booleanOptions: {
        flexDirection: "row",
        gap: spacing.exact(4),
        paddingHorizontal: spacing.exact(24),
      },
      feedbackCard: {
        marginHorizontal: -spacing.exact(24),
        marginBottom: -spacing.exact(24),
        borderTopLeftRadius: radius.xxxl,
        borderTopRightRadius: radius.xxxl,
        ...elevation.modal,
      },
      feedbackCardGradient: {
        borderTopLeftRadius: radius.xxxl,
        borderTopRightRadius: radius.xxxl,
        padding: spacing.exact(24),
        gap: 0,
        overflow: "hidden",
      },
      feedbackHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(10),
      },
      feedbackTitleRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(12),
      },
      feedbackTitle: {
        flex: 1,
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontFamily: getFontFamily("semiBold"),
        color: feedbackTitleColor,
      },
      feedbackHeaderActions: {
        flexDirection: "row",
        alignItems: "center",
      },
      feedbackIconButton: {
        width: spacing.exact(40),
        height: spacing.exact(40),
        alignItems: "center",
        justifyContent: "center",
      },
      feedbackSectionGapMd: {
        height: spacing.exact(16),
      },
      feedbackSectionGapXs: {
        height: spacing.exact(8),
      },
      feedbackBody: {
        alignSelf: "stretch",
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textSecondary,
      },
      feedbackBullets: {
        alignSelf: "stretch",
        gap: spacing.exact(8),
      },
      feedbackBulletRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.exact(4),
      },
      feedbackBulletIcon: {
        width: spacing.exact(20),
        height: spacing.exact(20),
        alignItems: "center",
        justifyContent: "center",
      },
      feedbackBulletText: {
        flex: 1,
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        color: colors.textSecondary,
      },
      masteryProgress: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("semiBold"),
        color: accents.green.ink,
      },
      explainRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(10),
        paddingVertical: spacing.exact(12),
        alignSelf: "stretch",
      },
      explainText: {
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
        color: accents.blue.ink,
      },
      premiumBadge: {
        width: spacing.exact(20),
        height: spacing.exact(20),
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
        fontFamily: getFontFamily("semiBold"),
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
        fontFamily: getFontFamily("bold"),
        textAlign: "center",
        color: colors.textPrimary,
        marginBottom: spacing.exact(16),
      },
      resultPercent: {
        fontSize: responsiveFont(40),
        lineHeight: responsiveFont(40),
        fontFamily: getFontFamily("bold"),
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
        fontFamily: getFontFamily("semiBold"),
        color: colors.textPrimary,
      },
      nextSubtitle: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        color: colors.textMuted,
      },
    }),
  );
}
