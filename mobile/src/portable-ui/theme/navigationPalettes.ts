import { DefaultTheme } from "expo-router/react-navigation";

import { darkTheme } from "../../theme/dark";
import { lightTheme } from "../../theme/light";

export const lightNavigationPalette = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: lightTheme.accents.green.fill,
    background: lightTheme.colors.paper,
    card: lightTheme.colors.white,
    text: lightTheme.colors.ink,
    border: lightTheme.colors.line,
    notification: lightTheme.accents.green.fill,
  },
};

export const darkNavigationPalette = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: darkTheme.accents.green.fill,
    background: darkTheme.colors.paper,
    card: darkTheme.colors.white,
    text: darkTheme.colors.ink,
    border: darkTheme.colors.line,
    notification: darkTheme.accents.green.fill,
  },
};
