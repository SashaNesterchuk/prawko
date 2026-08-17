import type { ViewStyle } from "react-native";

const shadowInk = "#142D21";
const shadowWarm = "#221F1B";

type ElevationPreset = Pick<
  ViewStyle,
  | "shadowColor"
  | "shadowOffset"
  | "shadowOpacity"
  | "shadowRadius"
  | "elevation"
  | "boxShadow"
>;

export const elevation = {
  card: {
    shadowColor: shadowInk,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    boxShadow: "0px 2px 12px rgba(20, 45, 33, 0.05)",
  },
  raised: {
    shadowColor: shadowInk,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 36,
    elevation: 8,
    boxShadow: "0px 14px 36px rgba(20, 45, 33, 0.1)",
  },
  lifted: {
    // Two stacked layers; the shadow* props can only carry the dominant one,
    // so boxShadow is what renders under the new architecture.
    shadowColor: shadowWarm,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 0,
    boxShadow:
      "0px 2px 4px rgba(34, 31, 27, 0.05), 0px 4px 10px rgba(34, 31, 27, 0.07)",
  },
  modal: {
    shadowColor: shadowInk,
    shadowOffset: { width: 0, height: 26 },
    shadowOpacity: 0.22,
    shadowRadius: 64,
    elevation: 16,
    boxShadow: "0px 26px 64px rgba(20, 45, 33, 0.22)",
  },
  sharp: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
    boxShadow:
      "0px 2px 2px rgba(0, 0, 0, 0.04), 0px 1px 1px rgba(0, 0, 0, 0.04)",
  },
} as const satisfies Record<string, ElevationPreset>;

export type ElevationTokens = typeof elevation;
