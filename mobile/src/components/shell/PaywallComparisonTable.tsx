import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

import {
  CText,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

export type PaywallComparisonCell =
  | { kind: "check" }
  | { kind: "cross" }
  | { kind: "label"; text: string; tone?: "muted" | "emphasis" | "danger" };

export type PaywallComparisonRow = {
  key: string;
  title: string;
  subtitle?: string;
  free: PaywallComparisonCell;
  premium: PaywallComparisonCell;
};

type PaywallComparisonTableProps = {
  freeLabel: string;
  premiumLabel: string;
  rows: PaywallComparisonRow[];
};

export function PaywallComparisonTable({
  freeLabel,
  premiumLabel,
  rows,
}: PaywallComparisonTableProps) {
  const styles = useStyles();

  return (
    <View style={styles.card} testID="paywall-comparison-table">
      <View style={[styles.row, styles.headerRow]}>
        <View style={styles.featureColumn} />
        <CText style={styles.headerFree}>{freeLabel}</CText>
        <CText semiBold style={styles.headerPremium}>
          {premiumLabel}
        </CText>
      </View>

      {rows.map((row, index) => {
        const isLast = index === rows.length - 1;

        return (
          <View
            key={row.key}
            style={[
              styles.row,
              isLast ? styles.lastRow : styles.rowBorder,
            ]}
            testID={`paywall-comparison-row-${row.key}`}
          >
            <View style={styles.featureColumn}>
              <CText medium style={styles.featureTitle}>
                {row.title}
              </CText>
              {row.subtitle ? (
                <CText style={styles.featureSubtitle}>{row.subtitle}</CText>
              ) : null}
            </View>
            <ComparisonCell cell={row.free} />
            <ComparisonCell cell={row.premium} />
          </View>
        );
      })}
    </View>
  );
}

function ComparisonCell({ cell }: { cell: PaywallComparisonCell }) {
  const theme = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles();

  return (
    <View style={styles.cell}>
      {cell.kind === "check" ? (
        <Ionicons
          color={theme.accents.green.ink}
          name="checkmark"
          size={responsiveFont(16)}
        />
      ) : null}
      {cell.kind === "cross" ? (
        <Ionicons
          color={theme.accents.red.fill}
          name="close"
          size={responsiveFont(16)}
        />
      ) : null}
      {cell.kind === "label" ? (
        <CText
          semiBold={cell.tone === "emphasis" || cell.tone === "danger"}
          style={[
            styles.cellLabel,
            cell.tone === "emphasis" ? styles.cellLabelEmphasis : null,
            cell.tone === "danger" ? styles.cellLabelDanger : null,
          ]}
        >
          {cell.text}
        </CText>
      ) : null}
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    card: {
      width: "100%",
      alignSelf: "stretch",
      borderRadius: radius.xxl,
      backgroundColor: colors.white,
      overflow: "hidden",
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(12),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(4),
      paddingHorizontal: spacing.exact(16),
      paddingVertical: spacing.exact(8),
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    lastRow: {
      paddingBottom: spacing.exact(16),
    },
    headerRow: {
      justifyContent: "flex-end",
      paddingVertical: spacing.exact(12),
    },
    featureColumn: {
      flex: 1,
      minWidth: 0,
    },
    headerFree: {
      width: spacing.exact(60),
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      textAlign: "center",
      color: colors.inkSecondary,
    },
    headerPremium: {
      width: spacing.exact(60),
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      textAlign: "center",
      color: theme.accents.amber.ink,
    },
    featureTitle: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: colors.ink,
    },
    featureSubtitle: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.inkMuted,
    },
    cell: {
      width: spacing.exact(60),
      alignItems: "center",
      justifyContent: "center",
      minHeight: spacing.exact(20),
    },
    cellLabel: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      textAlign: "center",
      color: colors.inkMuted,
    },
    cellLabelEmphasis: {
      color: theme.accents.green.fill,
    },
    cellLabelDanger: {
      color: theme.accents.red.fill,
    },
  }));
}
