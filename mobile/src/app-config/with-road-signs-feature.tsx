import { Redirect } from "expo-router";
import type { ComponentType } from "react";

import { getActiveCountryConfig } from "../countries/runtime";

/** Hides the signs tab/screens when the active country has no sign catalogue. */
export function withRoadSignsFeature<Props extends object>(
  Screen: ComponentType<Props>
) {
  return function RoadSignsFeatureGuard(props: Props) {
    if (!getActiveCountryConfig().features.roadSigns) {
      return <Redirect href="/(tabs)" />;
    }

    return <Screen {...props} />;
  };
}
