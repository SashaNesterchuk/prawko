import type { ViewStyle } from "react-native";

const shadowInk = "#142D21";

type ElevationPreset = Pick<
  ViewStyle,
  "shadowColor" | "shadowOffset" | "shadowOpacity" | "shadowRadius" | "elevation"
>;

export const elevation = {
  card: {
    shadowColor: shadowInk,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  raised: {
    shadowColor: shadowInk,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 36,
    elevation: 8,
  },
  modal: {
    shadowColor: shadowInk,
    shadowOffset: { width: 0, height: 26 },
    shadowOpacity: 0.22,
    shadowRadius: 64,
    elevation: 16,
  },
  sharp: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
} as const satisfies Record<string, ElevationPreset>;

export type ElevationTokens = typeof elevation;
