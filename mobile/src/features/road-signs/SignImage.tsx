import { useMemo } from "react";
import {
  Image,
  View,
  type ImageStyle,
  type ViewStyle,
} from "react-native";

import { useResponsiveStyles } from "../../portable-ui";
import { getSignAssetComponent } from "./content/signAssets";
import type { RoadSign } from "./types";

type SignImageProps = {
  sign: RoadSign;
  size?: number;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
};

export function SignImage({ sign, size = 72, style, imageStyle }: SignImageProps) {
  const styles = useStyles();
  const SvgComponent = getSignAssetComponent(sign.id);
  const dynamicStyles = useMemo(
    () => ({
      wrap: {
        width: size,
        height: size,
      },
      image: {
        width: size,
        height: size,
      },
    }),
    [size]
  );

  if (SvgComponent) {
    return (
      <View style={[styles.wrap, dynamicStyles.wrap, style]}>
        <SvgComponent width={size} height={size} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, dynamicStyles.wrap, style]}>
      <Image
        resizeMode="contain"
        source={{ uri: sign.previewUrl }}
        style={[dynamicStyles.image, imageStyle]}
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
