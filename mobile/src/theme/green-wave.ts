import { appTheme, type AppThemeAccent } from ".";

export const greenWave = {
  color: {
    ink: appTheme.colors.ink,
    inkSecondary: appTheme.colors.inkSecondary,
    inkMuted: appTheme.colors.inkMuted,
    surface: appTheme.colors.surface,
    onAccent: appTheme.colors.onAccent,
    paper: appTheme.colors.paper,
    skySoft: appTheme.colors.skySoft,
    line: appTheme.colors.line,
    track: appTheme.colors.track,
    shadow: appTheme.colors.shadow,
  },
  radius: {
    md: appTheme.radius.md,
    lg: appTheme.radius.lg,
    xl: appTheme.radius.xl,
    xxl: appTheme.radius.xxl,
    pill: appTheme.radius.pill,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
} as const;

export type GreenWaveAccent = AppThemeAccent;

export const greenWaveAccent = appTheme.accents;
