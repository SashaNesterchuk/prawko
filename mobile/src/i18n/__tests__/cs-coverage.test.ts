import { resources } from "../resources";
import { czechTranslations } from "../cs";

function leafPaths(
  value: unknown,
  prefix = "",
): string[] {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function hasPath(value: unknown, path: string) {
  return path.split(".").every((segment) => {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    if (!(segment in (value as Record<string, unknown>))) {
      return false;
    }

    value = (value as Record<string, unknown>)[segment];
    return true;
  });
}

describe("Czech translation coverage", () => {
  it("covers every English UI key", () => {
    const english = resources.en.translation;
    const missing = leafPaths(english).filter((path) => !hasPath(czechTranslations, path));

    expect(missing).toEqual([]);
  });
});
