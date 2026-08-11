import {
  computeWidthFontScale,
  effectiveFontScale,
  FIGMA_BASELINE,
  scaleFontSize,
} from "../font-scale";

describe("font-scale vs Figma 390 baseline", () => {
  it("matches Figma width 1:1", () => {
    expect(computeWidthFontScale(FIGMA_BASELINE.width)).toBe(1);
  });

  it("barely shrinks on SE-class width (375)", () => {
    const scale = computeWidthFontScale(375);
    expect(scale).toBeCloseTo(375 / 390, 5);
    expect(scale).toBeGreaterThan(0.95);
    expect(Math.round(scaleFontSize(16, scale))).toBe(16);
    expect(Math.round(scaleFontSize(12, scale))).toBe(12);
    expect(Math.round(scaleFontSize(32, scale))).toBe(31);
  });

  it("does not use height (short phones stay readable)", () => {
    // Old min(width,height) on SE used ~0.8; width-only keeps ~0.96
    const scale = computeWidthFontScale(375);
    expect(effectiveFontScale(14, scale)).toBeGreaterThanOrEqual(0.96);
  });

  it("clamps very small widths to MIN_SCALE", () => {
    expect(computeWidthFontScale(320)).toBe(0.92);
  });

  it("mildly upscales Pro Max width with a cap", () => {
    const scale = computeWidthFontScale(440);
    expect(scale).toBeCloseTo(1.12, 5);
    expect(Math.round(scaleFontSize(16, scale))).toBe(18);
  });

  it("protects label sizes more than display sizes when shrinking", () => {
    const scale = 0.92;
    expect(effectiveFontScale(11, scale)).toBe(0.98);
    expect(effectiveFontScale(16, scale)).toBe(0.98);
    expect(effectiveFontScale(24, scale)).toBe(0.94);
    expect(effectiveFontScale(32, scale)).toBe(0.92);
  });
});
