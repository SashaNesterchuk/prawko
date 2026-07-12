import {
  darkAccentColors,
  darkBackgroundColors,
  darkSemanticColors,
} from "./tokens/colors";
import { createTheme } from "./light";

export const darkTheme = createTheme(
  "dark",
  darkSemanticColors,
  darkAccentColors,
  darkBackgroundColors
);
