import type { FC } from "react";
import type { SvgProps } from "react-native-svg";

import SignCategoryA from "../../../assets/sign-category-icons/SignCategory-A.svg";
import SignCategoryB from "../../../assets/sign-category-icons/SignCategory-B.svg";
import SignCategoryC from "../../../assets/sign-category-icons/SignCategory-C.svg";
import SignCategoryD from "../../../assets/sign-category-icons/SignCategory-D.svg";
import SignCategoryE from "../../../assets/sign-category-icons/SignCategory-E.svg";
import SignCategoryF from "../../../assets/sign-category-icons/SignCategory-F.svg";
import SignCategoryG from "../../../assets/sign-category-icons/SignCategory-G.svg";
import SignCategoryP from "../../../assets/sign-category-icons/SignCategory-P.svg";
import SignCategoryS from "../../../assets/sign-category-icons/SignCategory-S.svg";
import SignCategoryT from "../../../assets/sign-category-icons/SignCategory-T.svg";
import SignCategoryW from "../../../assets/sign-category-icons/SignCategory-W.svg";
import type { RoadSignCategoryId } from "./types";

const SIGN_CATEGORY_ICONS: Record<RoadSignCategoryId, FC<SvgProps>> = {
  A: SignCategoryA,
  B: SignCategoryB,
  C: SignCategoryC,
  D: SignCategoryD,
  E: SignCategoryE,
  F: SignCategoryF,
  T: SignCategoryT,
  G: SignCategoryG,
  P: SignCategoryP,
  S: SignCategoryS,
  W: SignCategoryW,
};

type SignCategoryIconProps = {
  categoryId: RoadSignCategoryId;
  size?: number;
};

export function SignCategoryIcon({
  categoryId,
  size = 56,
}: SignCategoryIconProps) {
  const SvgComponent = SIGN_CATEGORY_ICONS[categoryId];

  return (
    <SvgComponent
      height={size}
      preserveAspectRatio="xMidYMid meet"
      width={size}
    />
  );
}
