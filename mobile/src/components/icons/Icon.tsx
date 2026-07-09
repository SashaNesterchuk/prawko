import type { SvgProps } from "react-native-svg";

import { iconRegistry, type IconName } from "./iconRegistry";

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
} & Omit<SvgProps, "width" | "height" | "color" | "fill">;

export function Icon({ name, size = 24, color, style, ...rest }: IconProps) {
  const SvgComponent = iconRegistry[name];

  return (
    <SvgComponent
      width={size}
      height={size}
      color={color}
      style={style}
      {...rest}
    />
  );
}

export type { IconName };
