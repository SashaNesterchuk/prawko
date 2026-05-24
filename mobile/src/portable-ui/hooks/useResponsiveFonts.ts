import { useMemo } from "react";
import { PixelRatio, useWindowDimensions } from "react-native";

const BASELINE_WIDTH = 440;
const BASELINE_HEIGHT = 956;

export interface ResponsiveFontHook {
  responsiveFont: (size: number) => number;
  scaleFactor: number;
  deviceInfo: {
    screenWidth: number;
    screenHeight: number;
    baselineWidth: number;
    baselineHeight: number;
    widthScale: number;
    heightScale: number;
    normalizedScale: number;
  };
}

export function useResponsiveFonts(): ResponsiveFontHook {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const scalingInfo = useMemo(() => {
    const widthScale = screenWidth / BASELINE_WIDTH;
    const heightScale = screenHeight / BASELINE_HEIGHT;
    const scale = Math.min(widthScale, heightScale);

    const MIN_SCALE = 0.8;
    const MAX_SCALE = 1.3;
    const normalizedScale = Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);

    return {
      widthScale,
      heightScale,
      normalizedScale,
      deviceInfo: {
        screenWidth,
        screenHeight,
        baselineWidth: BASELINE_WIDTH,
        baselineHeight: BASELINE_HEIGHT,
        widthScale,
        heightScale,
        normalizedScale,
      },
    };
  }, [screenWidth, screenHeight]);

  const responsiveFont = useMemo(() => {
    return (size: number): number => {
      const scale = scalingInfo.normalizedScale;

      const SMALL_THRESHOLD = 14;
      const MEDIUM_THRESHOLD = 18;

      let effectiveScale = scale;
      if (size <= SMALL_THRESHOLD) {
        effectiveScale = Math.max(scale, 0.95);
      } else if (size <= MEDIUM_THRESHOLD) {
        effectiveScale = Math.max(scale, 0.9);
      } else if (size <= 24) {
        effectiveScale = Math.max(scale, 0.85);
      }

      const newSize = size * effectiveScale;
      return Math.round(PixelRatio.roundToNearestPixel(newSize));
    };
  }, [scalingInfo.normalizedScale]);

  return {
    responsiveFont,
    scaleFactor: scalingInfo.normalizedScale,
    deviceInfo: scalingInfo.deviceInfo,
  };
}
