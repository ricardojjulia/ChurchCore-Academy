export const academyTheme = {
  palette: {
    blue: {
      50: "#eef5ff",
      100: "#d9e8ff",
      200: "#b7d1ff",
      300: "#8bb2ff",
      400: "#5c89f0",
      500: "#2f5bce",
      600: "#2447a7",
      700: "#1e3b88",
      800: "#18306f",
      900: "#122652",
    },
    gold: {
      50: "#fff9e6",
      100: "#fff0bf",
      200: "#ffe38a",
      300: "#ffd24d",
      400: "#ffc31f",
      500: "#d79a00",
      600: "#a87300",
      700: "#7f5800",
      800: "#624500",
      900: "#4a3400",
    },
    slate: {
      50: "#f8fbff",
      100: "#eef4fb",
      200: "#dbe7f4",
      300: "#c0d3e7",
      400: "#93afc9",
      500: "#6480a0",
      600: "#4d6785",
      700: "#3a5066",
      800: "#2a3c4d",
      900: "#182432",
    },
  },
  typography: {
    display: "'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif",
    body: "'Geist', 'Inter', ui-sans-serif, system-ui, sans-serif",
    mono: "'SFMono-Regular', 'SF Mono', ui-monospace, monospace",
  },
  spacing: {
    xs: "0.5rem",
    sm: "0.75rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    xxl: "3rem",
  },
} as const;

export type SensitivityTier = "standard" | "elevated" | "pastoral";
export type VisibilityTier = "instructor_only" | "staff_only" | "learner_safe";
export type ConsentState = "active" | "inactive" | "pending_review";
