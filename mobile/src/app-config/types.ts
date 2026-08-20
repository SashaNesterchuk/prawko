import type { AppTheme } from "../theme";

export type AppVariantId = "prawko" | "czech" | "greece";

export type AppVariantFeatures = {
  roadSigns: boolean;
};

export type AppVariantRuntime = {
  id: AppVariantId;
  theme: AppTheme;
  translations: Record<string, { translation: Record<string, unknown> }>;
};
