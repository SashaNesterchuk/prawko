import { useMemo } from "react";
import { PixelRatio, useWindowDimensions } from "react-native";

const BASELINE = { width: 440, height: 956 };
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.2;

function clamp(value: number, min: number, max: number) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function snap4(value: number) {
  return Math.round(value / 4) * 4;
}

export interface ResponsiveSpacingApi {
  value: (base: number) => number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export function useResponsiveSpacing(): ResponsiveSpacingApi {
  const { width, height } = useWindowDimensions();

  const scale = useMemo(() => {
    const nextScale = Math.min(width / BASELINE.width, height / BASELINE.height);
    return clamp(nextScale, MIN_SCALE, MAX_SCALE);
  }, [width, height]);

  const value = useMemo(() => {
    const mix = (a: number, b: number, weight: number) => a * (1 - weight) + b * weight;

    return (base: number) => {
      let factor = scale;

      if (base <= 12) {
        factor = mix(1, scale, 0.3);
      } else if (base <= 24) {
        factor = mix(1, scale, 0.6);
      } else if (base < 32) {
        factor = mix(1, scale, 0.8);
      } else {
        factor = scale;
      }

      const scaled = base * factor;
      const pxRounded = Math.round(PixelRatio.roundToNearestPixel(scaled));
      return snap4(pxRounded);
    };
  }, [scale]);

  return {
    value,
    xs: value(4),
    sm: value(8),
    md: value(12),
    lg: value(16),
    xl: value(20),
    xxl: value(24),
  };
}
