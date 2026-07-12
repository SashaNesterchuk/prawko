export const radius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  xxxxl: 28,
  pill: 999,
  // legacy aliases
  large: 16,
  xlarge: 20,
} as const;

export type RadiusTokens = typeof radius;
