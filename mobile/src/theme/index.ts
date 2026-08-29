import { DefaultTheme } from "expo-router/react-navigation";

import { darkTheme } from "./dark";
import { lightTheme, type AppTheme, type AppThemeColors, type ThemeMode } from "./light";

export type { AppTheme, AppThemeColors, ThemeMode };
export type AppThemeAccent = keyof AppTheme["accents"];

export const themes = {
  light: lightTheme,
  dark: darkTheme,
} as const;

export { darkTheme, lightTheme };
export const appTheme = lightTheme;

export function createNavigationTheme(theme: AppTheme) {
  return {
    ...DefaultTheme,
    dark: theme.mode === "dark",
    colors: {
      ...DefaultTheme.colors,
      background: theme.colors.paper,
      border: theme.colors.line,
      card: theme.colors.white,
      notification: theme.colors.accent,
      primary: theme.colors.accent,
      text: theme.colors.ink,
    },
  };
}

export const navigationTheme = createNavigationTheme(appTheme);
