/**
 * Prawko Figma artboards are 390×844 (Project file phone frames).
 * Fonts track width only — height would over-shrink short phones (SE).
 */
export const FIGMA_BASELINE = {
  width: 390,
  height: 844,
} as const;

export const FONT_SCALE = {
  min: 0.92,
  max: 1.12,
} as const;

export function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function computeWidthFontScale(screenWidth: number): number {
  return clamp(
    screenWidth / FIGMA_BASELINE.width,
    FONT_SCALE.min,
    FONT_SCALE.max
  );
}

/**
 * Size-aware floor: body/UI labels barely shrink; display type may flex more.
 * Design sizes stay 1:1 on the Figma width (390).
 */
export function effectiveFontScale(
  designSize: number,
  widthScale: number
): number {
  if (designSize <= 12) {
    return Math.max(widthScale, 0.98);
  }
  if (designSize <= 16) {
    return Math.max(widthScale, 0.98);
  }
  if (designSize <= 20) {
    return Math.max(widthScale, 0.96);
  }
  if (designSize <= 28) {
    return Math.max(widthScale, 0.94);
  }
  return widthScale;
}

export function scaleFontSize(designSize: number, widthScale: number): number {
  return designSize * effectiveFontScale(designSize, widthScale);
}
