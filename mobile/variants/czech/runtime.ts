import { createVariantTheme } from "../../src/app-config/create-variant-theme";
import type { AppVariantRuntime } from "../../src/app-config/types";
import { czechTranslations } from "./translations";

export const variantRuntime: AppVariantRuntime = {
  id: "czech",
  theme: createVariantTheme(
    {
      fill: "#3B82F6",
      ink: "#2563C4",
      soft: "rgba(59,130,246,0.13)",
      wash: "#D6E4FF",
    },
    {
      start: "#DCE8FF",
      end: "#EEF2F8",
      transparent: "rgba(220,232,255,0)",
    }
  ),
  // This is injected only into the Czech build. Prawko keeps its own resource
  // set untouched; any newly added shared key safely falls back to English.
  translations: {
    cs: { translation: czechTranslations },
    en: {
      translation: {
        profile: {
          shareMessage: "Prepare for the Czech driving exam with Řidičák.",
          supportEmailSubject: "Řidičák support",
        },
      },
    },
  },
};
