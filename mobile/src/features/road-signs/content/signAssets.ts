import type { ComponentType } from "react";
import type { ImageSourcePropType } from "react-native";
import type { SvgProps } from "react-native-svg";

import { getExamCountry } from "../../../state/app-shell";
import { getRoadSignAssetsForCountry } from "../../../countries/road-signs";

function getActiveRoadSignAssets() {
  return getRoadSignAssetsForCountry(getExamCountry());
}

export function getSignAssetComponent(
  signId: string,
): ComponentType<SvgProps> | undefined {
  return getActiveRoadSignAssets().getSignAssetComponent(signId);
}

export function getSignRasterSource(
  signId: string,
): ImageSourcePropType | undefined {
  return getActiveRoadSignAssets().getSignRasterSource(signId);
}

export const signAssets = new Proxy(
  {},
  {
    get(_target, signId: string) {
      const assets = getActiveRoadSignAssets().signAssets as Record<
        string,
        ComponentType<SvgProps> | undefined
      >;
      return assets[signId];
    },
  },
) as Record<string, ComponentType<SvgProps>>;
