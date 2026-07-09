export const greenWave = {
  color: {
    ink: "#15241d",
    inkSecondary: "#5a6a62",
    inkMuted: "#93a39b",
    surface: "rgba(255,255,255,0.74)",
    onAccent: "#ffffff",
    paper: "#eef4f1",
    skySoft: "#dff0e1",
    line: "rgba(24,52,38,0.07)",
    track: "rgba(24,52,38,0.07)",
    shadow: "#142d21",
  },
  radius: {
    md: 8,
    lg: 16,
    xl: 20,
    xxl: 24,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
} as const;

export type GreenWaveAccent = "green" | "blue" | "red" | "amber";

export const greenWaveAccent: Record<
  GreenWaveAccent,
  { fill: string; ink: string; soft: string }
> = {
  green: { fill: "#1fb574", ink: "#0e7a4c", soft: "rgba(31,181,116,0.14)" },
  blue: { fill: "#3b82f6", ink: "#2563c4", soft: "rgba(59,130,246,0.13)" },
  red: { fill: "#f0563f", ink: "#c33825", soft: "rgba(240,86,63,0.13)" },
  amber: { fill: "#f0a93a", ink: "#a9700d", soft: "rgba(240,169,58,0.16)" },
};
