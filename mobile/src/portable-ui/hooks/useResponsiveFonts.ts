import { useMemo } from "react";
import { PixelRatio, useWindowDimensions } from "react-native";

import {
  FIGMA_BASELINE,
  computeWidthFontScale,
  scaleFontSize,
} from "../typography/font-scale";

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

/**
 * Scales Figma design px to the current device.
 * Baseline = Figma frame width (390). Width-only so short phones stay readable.
 */
export function useResponsiveFonts(): ResponsiveFontHook {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const scalingInfo = useMemo(() => {
    const widthScale = computeWidthFontScale(screenWidth);
    const heightScale = screenHeight / FIGMA_BASELINE.height;

    return {
      widthScale,
      heightScale,
      normalizedScale: widthScale,
      deviceInfo: {
        screenWidth,
        screenHeight,
        baselineWidth: FIGMA_BASELINE.width,
        baselineHeight: FIGMA_BASELINE.height,
        widthScale,
        heightScale,
        normalizedScale: widthScale,
      },
    };
  }, [screenWidth, screenHeight]);

  const responsiveFont = useMemo(() => {
    return (size: number): number =>
      Math.round(
        PixelRatio.roundToNearestPixel(
          scaleFontSize(size, scalingInfo.normalizedScale)
        )
      );
  }, [scalingInfo.normalizedScale]);

  return useMemo(
    () => ({
      responsiveFont,
      scaleFactor: scalingInfo.normalizedScale,
      deviceInfo: scalingInfo.deviceInfo,
    }),
    [responsiveFont, scalingInfo.deviceInfo, scalingInfo.normalizedScale]
  );
}
