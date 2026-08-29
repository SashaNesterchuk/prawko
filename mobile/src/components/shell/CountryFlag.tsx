import type { CountryCode } from "@prawko/config";
import type { FC } from "react";
import type { SvgProps } from "react-native-svg";

import FlagCzech from "../../../assets/flags/flag-czech.svg";
import FlagPoland from "../../../assets/flags/flag-poland.svg";

const FLAG_BY_COUNTRY: Record<CountryCode, FC<SvgProps>> = {
  PL: FlagPoland,
  CZ: FlagCzech,
};

type CountryFlagProps = {
  country: CountryCode;
  size?: number;
};

export function CountryFlag({ country, size = 24 }: CountryFlagProps) {
  const Flag = FLAG_BY_COUNTRY[country];

  return <Flag width={size} height={size} />;
}
