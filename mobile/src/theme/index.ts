import { DefaultTheme } from "@react-navigation/native";

const accentPalette = {
  green: {
    fill: "#1fb574",
    ink: "#0e7a4c",
    soft: "rgba(31,181,116,0.14)",
  },
  blue: {
    fill: "#3b82f6",
    ink: "#2563c4",
    soft: "rgba(59,130,246,0.13)",
  },
  red: {
    fill: "#f0563f",
    ink: "#c33825",
    soft: "rgba(240,86,63,0.13)",
  },
  amber: {
    fill: "#f0a93a",
    ink: "#a9700d",
    soft: "rgba(240,169,58,0.16)",
  },
} as const;

const colors = {
  background: "#eef4f1",
  paper: "#eef4f1",
  backgroundSky: "#dff0e1",
  skySoft: "#dff0e1",
  surface: "rgba(255,255,255,0.74)",
  surfaceStrong: "#ffffff",
  cardAccent: accentPalette.green.soft,
  cardMuted: "rgba(255,255,255,0.82)",
  glassThin: "rgba(255,255,255,0.18)",
  glassSoft: "rgba(255,255,255,0.25)",
  glassTint: "rgba(255,255,255,0.55)",
  glassStrong: "rgba(255,255,255,0.7)",
  glassHeavy: "rgba(255,255,255,0.88)",
  accent: accentPalette.green.fill,
  accentMuted: accentPalette.green.fill,
  accentSoft: accentPalette.green.soft,
  onAccent: "#ffffff",
  onAccentMuted: "rgba(255,255,255,0.85)",
  onAccentSoft: "rgba(255,255,255,0.8)",
  textPrimary: "#15241d",
  textSecondary: "#5a6a62",
  textMuted: "#93a39b",
  ink: "#15241d",
  inkSecondary: "#5a6a62",
  inkMuted: "#93a39b",
  statusSuccessSurface: "#E6F2EC",
  statusSuccessBorder: "#5D8A80",
  statusErrorSurface: "#F7E7DF",
  statusErrorBorder: "#C2826B",
  warningInk: "#A44E37",
  warningSoft: "#ffe0db",
  borderSoft: "rgba(24,52,38,0.07)",
  borderStrong: "#93a39b",
  borderInverseSoft: "rgba(248,246,240,0.35)",
  line: "rgba(24,52,38,0.07)",
  track: "rgba(24,52,38,0.07)",
  overlayBackdrop: "rgba(0,0,0,0.6)",
  overlayScrim: "rgba(20,45,33,0.35)",
  overlayInk: "rgba(24,32,24,0.78)",
  shadow: "#142d21",
  shadowDeep: "#000000",
  shadowWarm: "#221f1b",
  white: "#ffffff",
  black: "#15241d",
  transparent: "transparent",
  success: accentPalette.green.fill,
  warning: accentPalette.amber.fill,
  error: accentPalette.red.fill,
  info: accentPalette.blue.fill,
} as const;

export const appTheme = {
  colors,
  accents: accentPalette,
  radius: {
    md: 8,
    large: 16,
    lg: 16,
    xlarge: 20,
    xl: 20,
    xxl: 24,
    pill: 999,
  },
} as const;

export type AppTheme = typeof appTheme;
export type AppThemeAccent = keyof typeof accentPalette;

export const navigationTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    ...colors,
    background: colors.background,
    border: colors.borderSoft,
    card: colors.paper,
    notification: colors.accent,
    primary: colors.accent,
    text: colors.textPrimary,
  },
};
