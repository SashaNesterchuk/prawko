import { createVariantTheme } from "../../src/app-config/create-variant-theme";
import type { AppVariantRuntime } from "../../src/app-config/types";

export const variantRuntime: AppVariantRuntime = {
  id: "czech",
  theme: createVariantTheme({
    fill: "#2D6CDF",
    ink: "#1F4EAB",
    soft: "rgba(45,108,223,0.14)",
    wash: "#DCE8FF",
  }),
  // Czech copy is intentionally incremental; missing keys fall back to English.
  translations: { cs: { translation: {} } },
};
