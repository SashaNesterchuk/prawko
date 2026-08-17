import type { ComponentType } from "react";
import type { ImageSourcePropType } from "react-native";
import type { SvgProps } from "react-native-svg";

import {
  generatedSignAssets,
  type SignAssetKey,
} from "./generatedSignAssets";
import { generatedRasterSignAssets } from "./generatedRasterSignAssets";

export const signAssets = generatedSignAssets;

export function getSignAssetComponent(
  signId: string
): ComponentType<SvgProps> | undefined {
  return signAssets[signId as SignAssetKey];
}

export function getSignRasterSource(
  signId: string
): ImageSourcePropType | undefined {
  return generatedRasterSignAssets[signId];
}
