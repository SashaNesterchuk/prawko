const ROAD_SIGN_CODE_PATTERN =
  /\b([A-GTW]-\d+(?:[a-z])?(?:-\d+(?:\.\d+)?[a-z]?)?)\b/giu;

/**
 * Extracts Polish road-sign identifiers written in explanation prose, for
 * example `B-20`, `A-11a`, or `C-13-16b`.
 */
export function extractExplanationSignCodes(explanation: string): string[] {
  const signCodes = new Set<string>();

  for (const match of explanation.matchAll(ROAD_SIGN_CODE_PATTERN)) {
    const signCode = normalizeRoadSignCode(match[1]);

    if (signCode) {
      signCodes.add(signCode);
    }
  }

  return [...signCodes];
}

function normalizeRoadSignCode(value: string) {
  const matched = value.match(
    /^([A-GTW])-(\d+)([a-z]?)(?:-(\d+(?:\.\d+)?)([a-z]?))?$/iu
  );

  if (!matched) {
    return null;
  }

  const [, category, number, suffix = "", variant, variantSuffix = ""] =
    matched;

  return [
    `${category.toUpperCase()}-${number}${suffix.toLowerCase()}`,
    variant ? `${variant}${variantSuffix.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join("-");
}
