import { appTheme, type AppThemeAccent } from ".";

export const greenWave = {
  color: {
    ink: appTheme.colors.ink,
    inkSecondary: appTheme.colors.ink2,
    inkMuted: appTheme.colors.ink3,
    surface: appTheme.colors.surface,
    surface2: appTheme.colors.surface2,
    inset: appTheme.colors.inset,
    icon: appTheme.colors.icon,
    onAccent: appTheme.colors.onAccent,
    paper: appTheme.colors.paper,
    skySoft: appTheme.colors.paper,
    line: appTheme.colors.line,
    track: appTheme.colors.line,
    shadow: appTheme.colors.shadow,
  },
  radius: appTheme.radius,
  spacing: appTheme.spacing,
  elevation: appTheme.elevation,
  typography: appTheme.typography,
} as const;

export type GreenWaveAccent = AppThemeAccent;

export const greenWaveAccent = appTheme.accents;
