import type { ComponentType } from "react";
import type { SvgProps } from "react-native-svg";

import PlRoadSignA1 from "../../../../assets/pl-road-signs-wikimedia/PL_road_sign_A-1.svg";

export type SignAssetKey = "A-1";

export const signAssets: Record<SignAssetKey, ComponentType<SvgProps>> = {
  "A-1": PlRoadSignA1,
};

export function getSignAssetComponent(
  assetKey: string | undefined
): ComponentType<SvgProps> | undefined {
  if (!assetKey) {
    return undefined;
  }

  return signAssets[assetKey as SignAssetKey];
}
