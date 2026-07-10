function parseHexChannel(value: string): number {
  return Number.parseInt(value, 16);
}

export function hexToRgba(hex: string, alpha = 1): string {
  const trimmed = hex.trim();

  if (/^rgba?\(/i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replace(/^#/, "");

  if (!/^[0-9a-f]{3,8}$/i.test(normalized)) {
    return trimmed;
  }

  let red: number;
  let green: number;
  let blue: number;

  if (normalized.length === 3) {
    red = parseHexChannel(normalized[0] + normalized[0]);
    green = parseHexChannel(normalized[1] + normalized[1]);
    blue = parseHexChannel(normalized[2] + normalized[2]);
  } else {
    red = parseHexChannel(normalized.slice(0, 2));
    green = parseHexChannel(normalized.slice(2, 4));
    blue = parseHexChannel(normalized.slice(4, 6));
  }

  const clampedAlpha = Math.min(1, Math.max(0, alpha));

  return `rgba(${red},${green},${blue},${clampedAlpha})`;
}
