import {
  PropsWithChildren,
  createContext,
  useContext,
} from "react";
import {
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";

import { appTheme, navigationTheme } from "../theme";

const ThemeContext = createContext(appTheme);

export function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <ThemeContext.Provider value={appTheme}>
      <NavigationThemeProvider value={navigationTheme}>
        {children}
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export const fallbackNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    ...navigationTheme.colors,
  },
};
