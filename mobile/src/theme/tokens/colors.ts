export type AccentPalette = {
  fill: string;
  ink: string;
  soft: string;
  /** Solid wash used for feedback / result panel gradients. */
  wash: string;
};

export type SemanticColors = {
  paper: string;
  surface: string;
  surface2: string;
  inset: string;
  line: string;
  ink: string;
  ink2: string;
  ink3: string;
  icon: string;
  iconInverted: string;
  white: string;
  black: string;
  transparent: string;
};

export type BackgroundColors = {
  start: string;
  end: string;
  transparent: string;
};

export type AccentColors = {
  green: AccentPalette;
  red: AccentPalette;
  amber: AccentPalette;
  blue: AccentPalette;
};

export const lightSemanticColors: SemanticColors = {
  paper: "#EEF4F2",
  surface: "rgba(255,255,255,0.74)",
  surface2: "rgba(24,52,41,0.07)",
  inset: "rgba(255,255,255,0.55)",
  line: "rgba(24,52,41,0.07)",
  ink: "#15241E",
  ink2: "#5A6A64",
  ink3: "#93A39D",
  icon: "#768881",
  iconInverted: "#FFFFFF",
  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
};

export const darkSemanticColors: SemanticColors = {
  paper: "#0E1814",
  surface: "rgba(255,255,255,0.07)",
  surface2: "rgba(255,255,255,0.10)",
  inset: "rgba(255,255,255,0.05)",
  line: "rgba(255,255,255,0.10)",
  ink: "#15241E",
  ink2: "#9FB0A9",
  ink3: "#6B7B75",
  icon: "#6B7B75",
  iconInverted: "#6B7B75",
  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
};

export const lightBackgroundColors: BackgroundColors = {
  start: "#DFF0E1",
  end: "#EEF4EC",
  transparent: "rgba(223,240,225,0)",
};

export const darkBackgroundColors: BackgroundColors = {
  start: "#1B1F1C",
  end: "#1B1F1C",
  transparent: "rgba(27,31,28,0)",
};

export const lightAccentColors: AccentColors = {
  green: {
    fill: "#1FB574",
    ink: "#0E7A4C",
    soft: "rgba(31,181,116,0.14)",
    wash: "#C6E8CD",
  },
  red: {
    fill: "#F0563F",
    ink: "#C33825",
    soft: "rgba(240,86,63,0.13)",
    wash: "#F4DFD8",
  },
  amber: {
    fill: "#F0A93A",
    ink: "#A9700D",
    soft: "rgba(240,169,58,0.16)",
    wash: "#F8E6C8",
  },
  blue: {
    fill: "#3B82F6",
    ink: "#2563C4",
    soft: "rgba(59,130,246,0.13)",
    wash: "#D6E4FF",
  },
};

export const darkAccentColors: AccentColors = {
  green: {
    fill: "#3DDC94",
    ink: "#84EDBC",
    soft: "rgba(61,220,148,0.16)",
    wash: "#1A3A2C",
  },
  red: {
    fill: "#FF7A68",
    ink: "#FFB0A4",
    soft: "rgba(255,122,104,0.16)",
    wash: "#3A221E",
  },
  amber: {
    fill: "#FFC15E",
    ink: "#FFD692",
    soft: "rgba(255,193,94,0.16)",
    wash: "#3A2E16",
  },
  blue: {
    fill: "#6EA8FF",
    ink: "#A8C8FF",
    soft: "rgba(110,168,255,0.16)",
    wash: "#1A2740",
  },
};
