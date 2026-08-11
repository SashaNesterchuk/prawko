import type { FC } from "react";
import type { SupportedLocale } from "@prawko/config";
import type { SvgProps } from "react-native-svg";

import FlagGermany from "../../../assets/flags/flag-germany.svg";
import FlagPoland from "../../../assets/flags/flag-poland.svg";
import FlagSpain from "../../../assets/flags/flag-spain.svg";
import FlagUk from "../../../assets/flags/flag-uk.svg";
import FlagUkraine from "../../../assets/flags/flag-ukraine.svg";

const FLAG_BY_LOCALE: Record<SupportedLocale, FC<SvgProps>> = {
  pl: FlagPoland,
  ua: FlagUkraine,
  en: FlagUk,
  de: FlagGermany,
  es: FlagSpain,
};

type LocaleFlagProps = {
  locale: SupportedLocale;
  size?: number;
};

export function LocaleFlag({ locale, size = 24 }: LocaleFlagProps) {
  const Flag = FLAG_BY_LOCALE[locale];

  return <Flag width={size} height={size} />;
}
