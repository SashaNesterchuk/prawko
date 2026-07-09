import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";

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
  return (
    <View style={styles.cell}>
      {cell.kind === "check" ? (
        <Ionicons
          color={greenWaveAccent.green.fill}
          name="checkmark"
          size={16}
        />
      ) : null}
      {cell.kind === "cross" ? (
        <Ionicons
          color={greenWaveAccent.red.fill}
          name="close"
          size={16}
        />
      ) : null}
      {cell.kind === "label" ? (
        <Text style={styles.cellLabel}>{cell.text}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: greenWave.radius.xl,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: greenWave.spacing.xs,
    paddingHorizontal: greenWave.spacing.lg,
    paddingVertical: greenWave.spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: greenWave.color.line,
  },
  headerRow: {
    justifyContent: "flex-end",
  },
  featureColumn: {
    flex: 1,
    minWidth: 0,
  },
  headerFree: {
    width: 60,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    textAlign: "center",
    color: greenWave.color.inkSecondary,
  },
  headerPremium: {
    width: 60,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    textAlign: "center",
    color: greenWaveAccent.amber.ink,
  },
  featureTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: greenWave.color.ink,
  },
  featureSubtitle: {
    marginTop: greenWave.spacing.xs,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: greenWave.color.inkMuted,
  },
  cell: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 20,
  },
  cellLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    textAlign: "center",
    color: greenWave.color.inkMuted,
  },
});
