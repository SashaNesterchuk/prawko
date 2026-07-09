import { Image, StyleSheet, View, type ImageStyle, type ViewStyle } from "react-native";

import { getSignContent } from "./content/registry";
import { getSignAssetComponent } from "./content/signAssets";
import type { RoadSign } from "./types";

type SignImageProps = {
  sign: RoadSign;
  size?: number;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
};

export function SignImage({ sign, size = 72, style, imageStyle }: SignImageProps) {
  const content = getSignContent(sign.id);
  const SvgComponent = getSignAssetComponent(content?.assetKey);

  if (SvgComponent) {
    return (
      <View style={[styles.wrap, { width: size, height: size }, style]}>
        <SvgComponent width={size} height={size} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <Image
        resizeMode="contain"
        source={{ uri: sign.previewUrl }}
        style={[{ width: size, height: size }, imageStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
