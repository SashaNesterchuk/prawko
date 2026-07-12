import {
  lightAccentColors,
  lightBackgroundColors,
  lightSemanticColors,
  type AccentColors,
  type BackgroundColors,
  type SemanticColors,
} from "./tokens/colors";
import { elevation } from "./tokens/elevation";
import { radius } from "./tokens/radius";
import { spacing } from "./tokens/spacing";
import { typographyPresets } from "./tokens/typography";

export type ThemeMode = "light" | "dark";

export type AppThemeColors = SemanticColors & {
  // legacy aliases — keep until all call sites migrate
  background: string;
  backgroundSky: string;
  surfaceStrong: string;
  cardAccent: string;
  cardMuted: string;
  glassThin: string;
  glassSoft: string;
  glassTint: string;
  glassStrong: string;
  glassHeavy: string;
  accent: string;
  accentMuted: string;
  accentSoft: string;
  onAccent: string;
  onAccentMuted: string;
  onAccentSoft: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  inkSecondary: string;
  inkMuted: string;
  statusSuccessSurface: string;
  statusSuccessBorder: string;
  statusErrorSurface: string;
  statusErrorBorder: string;
  warningInk: string;
  warningSoft: string;
  borderSoft: string;
  borderStrong: string;
  borderInverseSoft: string;
  track: string;
  overlayBackdrop: string;
  overlayScrim: string;
  overlayInk: string;
  shadow: string;
  shadowDeep: string;
  shadowWarm: string;
  skySoft: string;
  success: string;
  warning: string;
  error: string;
  info: string;
};

export type AppTheme = {
  mode: ThemeMode;
  colors: AppThemeColors;
  accents: AccentColors;
  background: BackgroundColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typographyPresets;
  elevation: typeof elevation;
};

function buildLegacyColors(
  semantic: SemanticColors,
  accents: AccentColors,
  background: BackgroundColors
): AppThemeColors {
  return {
    ...semantic,
    background: background.end,
    backgroundSky: background.start,
    surfaceStrong: semantic.white,
    cardAccent: accents.green.soft,
    cardMuted: semantic.paper,
    glassThin: "rgba(255,255,255,0.18)",
    glassSoft: "rgba(255,255,255,0.32)",
    glassTint: semantic.inset,
    glassStrong: semantic.surface,
    glassHeavy: "rgba(255,255,255,0.92)",
    accent: accents.green.fill,
    accentMuted: accents.green.fill,
    accentSoft: accents.green.soft,
    onAccent: semantic.white,
    onAccentMuted: "rgba(255,255,255,0.85)",
    onAccentSoft: "rgba(255,255,255,0.8)",
    textPrimary: semantic.ink,
    textSecondary: semantic.ink2,
    textMuted: semantic.ink3,
    inkSecondary: semantic.ink2,
    inkMuted: semantic.ink3,
    statusSuccessSurface: accents.green.soft,
    statusSuccessBorder: accents.green.fill,
    statusErrorSurface: accents.red.soft,
    statusErrorBorder: accents.red.fill,
    warningInk: accents.amber.ink,
    warningSoft: accents.amber.soft,
    borderSoft: semantic.line,
    borderStrong: semantic.line,
    borderInverseSoft: "rgba(255,255,255,0.42)",
    track: semantic.line,
    overlayBackdrop: "rgba(0,0,0,0.6)",
    overlayScrim: "rgba(21,36,30,0.28)",
    overlayInk: "rgba(21,36,30,0.78)",
    shadow: "#142D21",
    shadowDeep: semantic.black,
    shadowWarm: semantic.ink,
    skySoft: semantic.paper,
    success: accents.green.fill,
    warning: accents.amber.fill,
    error: accents.red.fill,
    info: accents.blue.fill,
  };
}

export function createTheme(
  mode: ThemeMode,
  semantic: SemanticColors,
  accents: AccentColors,
  background: BackgroundColors
): AppTheme {
  return {
    mode,
    colors: buildLegacyColors(semantic, accents, background),
    accents,
    background,
    spacing,
    radius,
    typography: typographyPresets,
    elevation,
  };
}

export const lightTheme = createTheme(
  "light",
  lightSemanticColors,
  lightAccentColors,
  lightBackgroundColors
);
