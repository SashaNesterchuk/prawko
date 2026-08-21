import type { ComponentType } from "react";
import type { ImageSourcePropType } from "react-native";
import type { SvgProps } from "react-native-svg";

export const signAssets: Record<string, ComponentType<SvgProps>> = {};

export function getSignAssetComponent(
  signId: string
): ComponentType<SvgProps> | undefined {
  return signAssets[signId];
}

export function getSignRasterSource(
  _signId: string
): ImageSourcePropType | undefined {
  return undefined;
}
