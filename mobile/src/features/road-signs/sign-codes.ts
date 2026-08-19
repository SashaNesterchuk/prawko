import { getRoadSignById } from "./catalog";
import type { RoadSign } from "./types";

/**
 * Matches codes like `B-20`, `C-12`, `A-12a`. Legal citations that show up in
 * the same sentences (`art. 25 ust. 1`) stay untouched because the letter part
 * has to be a single uppercase character.
 */
export const SIGN_CODE_PATTERN = /\b([A-Z]-\d+[a-z]?)\b/g;

/**
 * Signs mentioned in `text`, in first-appearance order and deduplicated.
 * Codes without a sign in the catalog are dropped, so a stale reference in an
 * explanation never renders an empty tile.
 */
export function extractSignReferences(
  text: string | null | undefined,
  excludeSignId?: string
): RoadSign[] {
  if (!text) {
    return [];
  }

  const signs: RoadSign[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(SIGN_CODE_PATTERN)) {
    const code = match[1];

    if (seen.has(code)) {
      continue;
    }
    seen.add(code);

    const sign = getRoadSignById(code);
    if (sign && sign.id !== excludeSignId) {
      signs.push(sign);
    }
  }

  return signs;
}
