import { lightTheme, type AppTheme } from "../theme/light";

/** Keeps component token contracts stable while allowing each app a brand accent. */
export function createVariantTheme(
  accent: AppTheme["accents"]["green"],
  background: AppTheme["background"] = lightTheme.background
): AppTheme {
  return {
    ...lightTheme,
    colors: {
      ...lightTheme.colors,
      accent: accent.fill,
      accentMuted: accent.fill,
      accentSoft: accent.soft,
      cardAccent: accent.soft,
      statusSuccessBorder: accent.fill,
      statusSuccessSurface: accent.soft,
      success: accent.fill,
      background: background.end,
      backgroundSky: background.start,
    },
    accents: {
      ...lightTheme.accents,
      green: accent,
    },
    background,
  };
}
