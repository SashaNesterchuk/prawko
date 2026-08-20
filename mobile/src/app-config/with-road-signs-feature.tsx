import { Redirect } from "expo-router";
import type { ComponentType } from "react";

import { appVariant } from "./runtime";

/** Prevents deep links from exposing the Polish sign catalogue in another app. */
export function withRoadSignsFeature<Props extends object>(
  Screen: ComponentType<Props>
) {
  return function RoadSignsFeatureGuard(props: Props) {
    if (!appVariant.features.roadSigns) {
      return <Redirect href="/(tabs)" />;
    }

    return <Screen {...props} />;
  };
}
