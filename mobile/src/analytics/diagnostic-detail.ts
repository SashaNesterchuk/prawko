import type { AnalyticsValue } from "./catalog";

/** Pipe-free `key=value` line for PostHog. Avoid the forbidden `message` key. */
export function buildDiagnosticDetail(
  parts: Record<string, AnalyticsValue | undefined>
) {
  return Object.entries(parts)
    .flatMap(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return [];
      }

      if (typeof value === "boolean") {
        return [`${key}=${value ? "yes" : "no"}`];
      }

      return [`${key}=${value}`];
    })
    .join(" ");
}
