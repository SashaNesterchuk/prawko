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
  exact: (base: number) => number;
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

  const scaleValue = useMemo(() => {
    const mix = (a: number, b: number, weight: number) => a * (1 - weight) + b * weight;

    return (base: number, snapToGrid: boolean) => {
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
      return snapToGrid ? snap4(pxRounded) : pxRounded;
    };
  }, [scale]);

  const value = useMemo(() => {
    return (base: number) => scaleValue(base, true);
  }, [scaleValue]);

  const exact = useMemo(() => {
    return (base: number) => scaleValue(base, false);
  }, [scaleValue]);

  return useMemo(
    () => ({
      value,
      exact,
      xs: exact(4),
      sm: exact(8),
      md: exact(12),
      lg: exact(16),
      xl: exact(20),
      xxl: exact(24),
    }),
    [exact, value]
  );
}
