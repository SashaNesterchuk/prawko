import { View } from "react-native";

import {
  CText,
  getFontFamily,
  useResponsiveStyles,
} from "../../portable-ui";
import { DualColorProgressBar } from "./DualColorProgressBar";
import { resolveSignsSummaryDisplay } from "./signs-summary-display";

type QuestionCoverageCardProps = {
  correct: number;
  wrong: number;
  seen: number;
  total: number;
  title?: string;
  /** White elevated card (hubs) vs a tight strip (in-session). */
  variant?: "card" | "plain";
  testID?: string;
};

export function QuestionCoverageCard({
  correct,
  wrong,
  seen,
  total,
  title,
  variant = "card",
  testID,
}: QuestionCoverageCardProps) {
  const display = resolveSignsSummaryDisplay({
    correct,
    wrong,
    seen,
    total,
  });
  const styles = useStyles();
  const isCard = variant === "card";

  return (
    <View style={isCard ? styles.card : styles.plain} testID={testID}>
      <View style={isCard ? styles.cardInner : styles.plainInner}>
        <View style={styles.headerRow}>
          {title ? (
            <CText style={isCard ? styles.title : styles.inlineTitle}>
              {title}
            </CText>
          ) : (
            <CText
              style={styles.fraction}
              testID={testID ? `${testID}-count` : undefined}
            >
              {display.coverageLabel}
            </CText>
          )}
          <CText
            style={isCard ? styles.percent : styles.inlinePercent}
            testID={testID ? `${testID}-percent` : undefined}
          >
            {`${display.learnedPercent}%`}
          </CText>
        </View>

        {title ? (
          <CText
            style={styles.fraction}
            testID={testID ? `${testID}-count` : undefined}
          >
            {display.coverageLabel}
          </CText>
        ) : null}

        <DualColorProgressBar
          correct={correct}
          wrong={wrong}
          total={total}
          height={8}
        />
      </View>
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(
    ({ colors, elevation, radius, responsiveFont, spacing }) => ({
      card: {
        borderRadius: radius.xxl,
        backgroundColor: colors.white,
        ...elevation.card,
      },
      cardInner: {
        gap: spacing.exact(4),
        paddingTop: spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
      },
      plain: {
        width: "100%",
      },
      plainInner: {
        gap: spacing.exact(4),
        paddingHorizontal: spacing.exact(24),
        paddingTop: spacing.exact(12),
      },
      headerRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: spacing.md,
      },
      title: {
        flex: 1,
        fontSize: responsiveFont(24),
        lineHeight: responsiveFont(32),
        fontFamily: getFontFamily("bold"),
        color: colors.ink,
      },
      inlineTitle: {
        flex: 1,
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("medium"),
        color: colors.ink,
      },
      percent: {
        fontSize: responsiveFont(24),
        lineHeight: responsiveFont(32),
        fontFamily: getFontFamily("semiBold"),
        color: colors.ink,
      },
      inlinePercent: {
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontFamily: getFontFamily("semiBold"),
        color: colors.ink,
      },
      fraction: {
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontFamily: getFontFamily("regular"),
        color: colors.ink,
      },
    })
  );
}
