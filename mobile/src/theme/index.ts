import { DefaultTheme } from "@react-navigation/native";

export const appTheme = {
  colors: {
    background: "#F4EFE8",
    surface: "#FFFDF8",
    cardAccent: "#F8F2E4",
    cardMuted: "#EDE4D3",
    accent: "#1E5B4F",
    accentMuted: "#5D8A80",
    onAccent: "#F8F6F0",
    textPrimary: "#182018",
    textSecondary: "#4E5A52",
    textMuted: "#7A817C",
    borderSoft: "#D8D1C6",
    borderStrong: "#B7AD9A",
    shadow: "#0E120F",
  },
  radius: {
    large: 18,
    xlarge: 24,
  },
} as const;

export const navigationTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    background: appTheme.colors.background,
    card: appTheme.colors.surface,
    border: appTheme.colors.borderSoft,
    notification: appTheme.colors.accent,
    primary: appTheme.colors.accent,
    text: appTheme.colors.textPrimary,
  },
};
