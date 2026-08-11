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
    <View style={styles.card}>
      <View style={[styles.row, styles.headerRow]}>
        <View style={styles.featureColumn} />
        <CText style={styles.headerFree}>{freeLabel}</CText>
        <CText style={styles.headerPremium}>{premiumLabel}</CText>
      </View>

      {rows.map((row, index) => (
        <View
          key={row.key}
          style={[styles.row, index < rows.length - 1 ? styles.rowBorder : null]}
        >
          <View style={styles.featureColumn}>
            <CText style={styles.featureTitle}>{row.title}</CText>
            {row.subtitle ? (
              <CText style={styles.featureSubtitle}>{row.subtitle}</CText>
            ) : null}
          </View>
          <ComparisonCell cell={row.free} />
          <ComparisonCell cell={row.premium} />
        </View>
      ))}
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
          color={theme.accents.green.fill}
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
      borderRadius: radius.xl,
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
    headerRow: {
      justifyContent: "flex-end",
      paddingVertical: spacing.exact(12),
    },
    featureColumn: {
      flex: 1,
      minWidth: 0,
    },
    headerFree: {
      width: spacing.exact(72),
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      textAlign: "center",
      color: colors.inkSecondary,
    },
    headerPremium: {
      width: spacing.exact(72),
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "600",
      textAlign: "center",
      color: theme.accents.amber.ink,
    },
    featureTitle: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "500",
      color: colors.ink,
    },
    featureSubtitle: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
      color: colors.inkMuted,
    },
    cell: {
      width: spacing.exact(72),
      alignItems: "center",
      justifyContent: "center",
      minHeight: spacing.exact(20),
    },
    cellLabel: {
      fontSize: responsiveFont(11),
      lineHeight: responsiveFont(14),
      fontWeight: "400",
      textAlign: "center",
      color: colors.inkMuted,
    },
    cellLabelEmphasis: {
      fontWeight: "600",
      color: theme.accents.green.fill,
    },
    cellLabelDanger: {
      fontWeight: "600",
      color: theme.accents.red.fill,
    },
  }));
}
