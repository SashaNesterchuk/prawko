import { createVariantTheme } from "../../src/app-config/create-variant-theme";
import type { AppVariantRuntime } from "../../src/app-config/types";
import { czechTranslations } from "./translations";

export const variantRuntime: AppVariantRuntime = {
  id: "czech",
  theme: createVariantTheme({
    // Czech red makes this development variant immediately distinct from Prawko.
    fill: "#D7141A",
    ink: "#A30F14",
    soft: "rgba(215,20,26,0.14)",
    wash: "#FCE1E2",
  }),
  // This is injected only into the Czech build. Prawko keeps its own resource
  // set untouched; any newly added shared key safely falls back to English.
  translations: { cs: { translation: czechTranslations } },
};
