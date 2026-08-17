import type { ReactNode } from "react";
import { View } from "react-native";

import { useResponsiveStyles } from "../../portable-ui";
import { type GreenWaveAccent } from "../../theme/green-wave";
import { ActionTile, type ActionTileStyle } from "./ActionTile";

export type ActionTileItem = {
  key: string;
  title: string;
  subtitle: string;
  accent?: GreenWaveAccent;
  premium?: boolean;
  style?: ActionTileStyle;
  icon?: ReactNode;
  onPress?: () => void;
  testID?: string;
};

type ActionTileGridProps = {
  items: ActionTileItem[];
  columns?: number;
};

export function ActionTileGrid({ items, columns = 2 }: ActionTileGridProps) {
  const styles = useStyles();
  const rows = chunk(items, Math.max(1, columns));

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((item) => (
            <ActionTile
              key={item.key}
              title={item.title}
              subtitle={item.subtitle}
              accent={item.accent}
              premium={item.premium}
              style={item.style}
              icon={item.icon}
              onPress={item.onPress}
              testID={item.testID ?? `action-tile-${item.key}`}
            />
          ))}
          {row.length < columns
            ? Array.from({ length: columns - row.length }).map((_, fillerIndex) => (
                <View key={`filler-${rowIndex}-${fillerIndex}`} style={styles.filler} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function useStyles() {
  return useResponsiveStyles(({ spacing }) => ({
    grid: {
      width: "100%",
      flexDirection: "column",
      gap: spacing.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: spacing.sm,
    },
    filler: {
      flex: 1,
      minWidth: spacing.exact(100),
    },
  }));
}
