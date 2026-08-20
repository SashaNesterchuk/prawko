import { createVariantTheme } from "../../src/app-config/create-variant-theme";
import type { AppVariantRuntime } from "../../src/app-config/types";

export const variantRuntime: AppVariantRuntime = {
  id: "greece",
  theme: createVariantTheme({
    fill: "#1D78B5",
    ink: "#14547E",
    soft: "rgba(29,120,181,0.14)",
    wash: "#D8EEFC",
  }),
  // Greek copy is intentionally incremental; missing keys fall back to English.
  translations: { el: { translation: {} } },
};
