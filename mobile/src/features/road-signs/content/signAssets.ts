import type { ComponentType } from "react";
import type { SvgProps } from "react-native-svg";

import {
  generatedSignAssets,
  type SignAssetKey,
} from "./generatedSignAssets";

export const signAssets = generatedSignAssets;

export function getSignAssetComponent(
  signId: string
): ComponentType<SvgProps> | undefined {
  return signAssets[signId as SignAssetKey];
}
