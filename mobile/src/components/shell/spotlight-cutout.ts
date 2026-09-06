import type { LayoutRectangle } from "react-native";

export function holesAreClose(
  left: LayoutRectangle | null,
  right: LayoutRectangle,
  epsilon = 1
): boolean {
  if (left == null) {
    return false;
  }

  return (
    Math.abs(left.x - right.x) <= epsilon &&
    Math.abs(left.y - right.y) <= epsilon &&
    Math.abs(left.width - right.width) <= epsilon &&
    Math.abs(left.height - right.height) <= epsilon
  );
}

export function holeRelativeToOverlay(
  overlayOrigin: { x: number; y: number },
  anchor: LayoutRectangle
): LayoutRectangle {
  return {
    x: anchor.x - overlayOrigin.x,
    y: anchor.y - overlayOrigin.y,
    width: anchor.width,
    height: anchor.height,
  };
}

export function paddedHole(
  hole: LayoutRectangle,
  padding: number
): LayoutRectangle {
  return {
    x: hole.x - padding,
    y: hole.y - padding,
    width: hole.width + padding * 2,
    height: hole.height + padding * 2,
  };
}

/** Even-odd path: full rect minus a rounded hole. */
export function spotlightCutoutPath(input: {
  windowWidth: number;
  windowHeight: number;
  hole: LayoutRectangle;
  radius: number;
}) {
  const { windowWidth, windowHeight, hole } = input;
  const r = Math.max(
    0,
    Math.min(input.radius, hole.width / 2, hole.height / 2)
  );
  const x = hole.x;
  const y = hole.y;
  const right = x + hole.width;
  const bottom = y + hole.height;

  const outer = `M0 0 H${windowWidth} V${windowHeight} H0 Z`;
  const inner = `M${x + r} ${y} H${right - r} Q${right} ${y} ${right} ${y + r} V${bottom - r} Q${right} ${bottom} ${right - r} ${bottom} H${x + r} Q${x} ${bottom} ${x} ${bottom - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;

  return `${outer} ${inner}`;
}
