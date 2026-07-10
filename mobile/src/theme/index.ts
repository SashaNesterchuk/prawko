import { DefaultTheme } from "@react-navigation/native";

const accentPalette = {
  green: {
    fill: "#7E7461",
    ink: "#5E5546",
    soft: "rgba(126,116,97,0.14)",
  },
  blue: {
    fill: "#246AC5",
    ink: "#1C4F93",
    soft: "rgba(36,106,197,0.13)",
  },
  red: {
    fill: "#DD2312",
    ink: "#BC2409",
    soft: "rgba(221,35,18,0.12)",
  },
  amber: {
    fill: "#EBA729",
    ink: "#CF5F00",
    soft: "rgba(235,167,41,0.18)",
  },
} as const;

const colors = {
  background: "#ffffff",
  paper: "#ffffff",
  backgroundSky: "#F6F5F3",
  skySoft: "#E3E0DB",
  surface: "rgba(255,255,255,0.86)",
  surfaceStrong: "#ffffff",
  cardAccent: accentPalette.green.soft,
  cardMuted: "#F6F6F6",
  glassThin: "rgba(255,255,255,0.18)",
  glassSoft: "rgba(255,255,255,0.32)",
  glassTint: "rgba(255,255,255,0.62)",
  glassStrong: "rgba(255,255,255,0.78)",
  glassHeavy: "rgba(255,255,255,0.92)",
  accent: accentPalette.green.fill,
  accentMuted: accentPalette.green.fill,
  accentSoft: accentPalette.green.soft,
  onAccent: "#ffffff",
  onAccentMuted: "rgba(255,255,255,0.85)",
  onAccentSoft: "rgba(255,255,255,0.8)",
  textPrimary: "#404040",
  textSecondary: "#7B756C",
  textMuted: "#A79D8A",
  ink: "#404040",
  inkSecondary: "#7B756C",
  inkMuted: "#A79D8A",
  statusSuccessSurface: "#E8F6F1",
  statusSuccessBorder: "#14A87B",
  statusErrorSurface: "#FBECE8",
  statusErrorBorder: "#DD2312",
  warningInk: "#BC2409",
  warningSoft: "#FEFEF4",
  borderSoft: "rgba(64,64,64,0.08)",
  borderStrong: "#D0D7E5",
  borderInverseSoft: "rgba(255,255,255,0.42)",
  line: "rgba(64,64,64,0.08)",
  track: "#E3E0DB",
  overlayBackdrop: "rgba(0,0,0,0.6)",
  overlayScrim: "rgba(64,64,64,0.28)",
  overlayInk: "rgba(34,34,34,0.78)",
  shadow: "#404040",
  shadowDeep: "#000000",
  shadowWarm: "#404040",
  white: "#ffffff",
  black: "#404040",
  transparent: "transparent",
  success: "#14A87B",
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
