import type { ComponentType } from "react";
import type { ImageSourcePropType } from "react-native";
import type { SvgProps } from "react-native-svg";

import { getOfflineRoadSignImageUri } from "../../src/features/offline/offline-pack";
import { getSignRasterSource as getCzechSignRasterSource } from "../czech/road-sign-assets";
import { CZECH_RASTER_ALIASES } from "./cz-raster-aliases";

export { CZECH_RASTER_ALIASES };

export const signAssets: Record<string, ComponentType<SvgProps>> = {};

export function getSignAssetComponent(
  signId: string,
): ComponentType<SvgProps> | undefined {
  return signAssets[signId];
}

export function getSignRasterSource(
  signId: string,
): ImageSourcePropType | undefined {
  const czechId = CZECH_RASTER_ALIASES[signId];
  if (czechId) {
    return getCzechSignRasterSource(czechId);
  }

  const offlineUri = getOfflineRoadSignImageUri(signId);
  return offlineUri ? { uri: offlineUri } : undefined;
}
