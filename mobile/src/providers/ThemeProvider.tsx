import {
  PropsWithChildren,
  createContext,
  useContext,
} from "react";
import {
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";

import {
  appTheme,
  createNavigationTheme,
  themes,
  type AppTheme,
  type ThemeMode,
} from "../theme";

type ThemeContextValue = {
  theme: AppTheme;
  mode: ThemeMode;
  themes: typeof themes;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: appTheme,
  mode: "light",
  themes,
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const theme = appTheme;

  return (
    <ThemeContext.Provider value={{ theme, mode: theme.mode, themes }}>
      <NavigationThemeProvider value={createNavigationTheme(theme)}>
        {children}
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext).theme;
}

export function useThemeMode() {
  return useContext(ThemeContext).mode;
}

export const fallbackNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    ...createNavigationTheme(appTheme).colors,
  },
};
