import { useMemo } from "react";
import {
  Image,
  View,
  type ImageStyle,
  type ViewStyle,
} from "react-native";

import { useResponsiveStyles } from "../../portable-ui";
import {
  getSignAssetComponent,
  getSignRasterSource,
} from "./content/signAssets";
import type { RoadSign } from "./types";

type SignImageProps = {
  sign: RoadSign;
  size?: number;
  width?: number;
  height?: number;
  inset?: number;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
};

export function SignImage({
  sign,
  size = 72,
  width,
  height,
  inset,
  style,
  imageStyle,
}: SignImageProps) {
  const styles = useStyles();
  const frameWidth = width ?? size;
  const frameHeight = height ?? size;
  const resolvedInset =
    inset ?? Math.max(4, Math.round(Math.min(frameWidth, frameHeight) * 0.08));
  const renderWidth = frameWidth - resolvedInset * 2;
  const renderHeight = frameHeight - resolvedInset * 2;
  const SvgComponent = getSignAssetComponent(sign.id);
  const rasterSource = getSignRasterSource(sign.id);
  const frameStyle = useMemo(
    () => ({
      width: frameWidth,
      height: frameHeight,
    }),
    [frameWidth, frameHeight]
  );

  if (SvgComponent) {
    return (
      <View style={[styles.wrap, frameStyle, style]}>
        <SvgComponent
          height={renderHeight}
          preserveAspectRatio="xMidYMid meet"
          width={renderWidth}
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, frameStyle, style]}>
      <Image
        resizeMode="contain"
        source={rasterSource ?? { uri: sign.previewUrl }}
        style={[
          { width: renderWidth, height: renderHeight },
          imageStyle,
        ]}
      />
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(() => ({
    wrap: {
      alignItems: "center",
      justifyContent: "center",
    },
  }));
}
