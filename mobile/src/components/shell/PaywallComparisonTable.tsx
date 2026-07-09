import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

export type PaywallComparisonCell =
  | { kind: "check" }
  | { kind: "cross" }
  | { kind: "label"; text: string };

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
        <Text style={styles.headerFree}>{freeLabel}</Text>
        <Text style={styles.headerPremium}>{premiumLabel}</Text>
      </View>

      {rows.map((row, index) => (
        <View
          key={row.key}
          style={[styles.row, index < rows.length - 1 ? styles.rowBorder : null]}
        >
          <View style={styles.featureColumn}>
            <Text style={styles.featureTitle}>{row.title}</Text>
            {row.subtitle ? (
              <Text style={styles.featureSubtitle}>{row.subtitle}</Text>
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
        <Text style={styles.cellLabel}>{cell.text}</Text>
      ) : null}
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    card: {
      width: "100%",
      borderRadius: radius.xl,
      backgroundColor: colors.white,
      overflow: "hidden",
      shadowColor: colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: spacing.exact(16),
      shadowOffset: { width: 0, height: spacing.exact(4) },
      elevation: 4,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    headerRow: {
      justifyContent: "flex-end",
    },
    featureColumn: {
      flex: 1,
      minWidth: 0,
    },
    headerFree: {
      width: spacing.exact(60),
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "500",
      textAlign: "center",
      color: colors.inkSecondary,
    },
    headerPremium: {
      width: spacing.exact(60),
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "500",
      textAlign: "center",
      color: theme.accents.amber.ink,
    },
    featureTitle: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "600",
      color: colors.ink,
    },
    featureSubtitle: {
      marginTop: spacing.xs,
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "400",
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
      fontWeight: "400",
      textAlign: "center",
      color: colors.inkMuted,
    },
  }));
}
