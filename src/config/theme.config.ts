import type { CSSProperties } from "react";

export const themeConfig = {
  colors: {
    ink: "#0b0b0d",
    inkSoft: "#4b4d55",
    paper: "#eef3fb",
    surface: "#ffffff",
    line: "#d7e0ee",
    lineDark: "#232323",
    accent: "#1476ff",
    accentDark: "#0d4ed8",
    cyan: "#14d7e5",
    violet: "#7257ff",
    green: "#00a8a8",
    purple: "#6252d9",
    orange: "#1aa7ff",
    blue: "#1476ff",
    muted: "#6b6e76",
  },
  gradients: {
    glow: "linear-gradient(135deg, #1476ff 0%, #14d7e5 48%, #7257ff 100%)",
    soft: "linear-gradient(135deg, rgba(20, 118, 255, 0.16), rgba(20, 215, 229, 0.12), rgba(114, 87, 255, 0.12))",
    card: "linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(246, 250, 255, 0.9))",
  },
  shadows: {
    card: "0 18px 42px rgba(12, 35, 82, 0.09)",
    cardHover: "0 24px 58px rgba(20, 118, 255, 0.18)",
  },
  radius: "16px",
} as const;

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

export function themeCssVariables(): ThemeStyle {
  return {
    "--ink": themeConfig.colors.ink,
    "--ink-soft": themeConfig.colors.inkSoft,
    "--paper": themeConfig.colors.paper,
    "--surface": themeConfig.colors.surface,
    "--line": themeConfig.colors.line,
    "--line-dark": themeConfig.colors.lineDark,
    "--accent": themeConfig.colors.accent,
    "--accent-dark": themeConfig.colors.accentDark,
    "--cyan": themeConfig.colors.cyan,
    "--violet": themeConfig.colors.violet,
    "--green": themeConfig.colors.green,
    "--purple": themeConfig.colors.purple,
    "--orange": themeConfig.colors.orange,
    "--blue": themeConfig.colors.blue,
    "--muted": themeConfig.colors.muted,
    "--glow-gradient": themeConfig.gradients.glow,
    "--soft-gradient": themeConfig.gradients.soft,
    "--card-gradient": themeConfig.gradients.card,
    "--card-shadow": themeConfig.shadows.card,
    "--card-shadow-hover": themeConfig.shadows.cardHover,
    "--radius": themeConfig.radius,
  };
}
