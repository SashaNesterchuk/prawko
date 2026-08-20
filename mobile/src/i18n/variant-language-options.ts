export const variantLanguageOptions = {
  cs: {
    label: "Čeština",
    description: "Czech interface and driving theory content.",
  },
  el: {
    label: "Ελληνικά",
    description: "Greek interface and driving theory content.",
  },
} as const;

export function mergeResources(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...base };

  for (const [key, override] of Object.entries(overrides)) {
    const current = result[key];
    result[key] =
      current &&
      override &&
      typeof current === "object" &&
      typeof override === "object" &&
      !Array.isArray(current) &&
      !Array.isArray(override)
        ? mergeResources(
            current as Record<string, unknown>,
            override as Record<string, unknown>
          )
        : override;
  }

  return result;
}

export function withVariantLanguageOptions(
  resources: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(resources).map(([locale, bundle]) => [
      locale,
      mergeResources(bundle as Record<string, unknown>, {
        translation: { languages: variantLanguageOptions },
      }),
    ])
  );
}
