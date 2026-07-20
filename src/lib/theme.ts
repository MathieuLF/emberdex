import type { CSSProperties } from "react";
import type { ThemeTokens } from "@emberdex/core";

export function themeToCssVariables(theme: ThemeTokens): CSSProperties {
  return {
    ["--background" as never]: theme.background,
    ["--background-alt" as never]: theme.backgroundAlt,
    ["--surface" as never]: theme.surface,
    ["--surface-strong" as never]: theme.surfaceStrong,
    ["--surface-elevated" as never]: theme.surfaceElevated,
    ["--line" as never]: theme.line,
    ["--text" as never]: theme.text,
    ["--muted" as never]: theme.muted,
    ["--accent" as never]: theme.accent,
    ["--accent-soft" as never]: theme.accentSoft,
    ["--accent-secondary" as never]: theme.accentSecondary,
    ["--success" as never]: theme.success,
    ["--warning" as never]: theme.warning,
    ["--danger" as never]: theme.danger,
    ["--glow" as never]: theme.glow,
    ["--shadow" as never]: theme.shadow,
  } as CSSProperties;
}

export function mergeTheme(
  base: ThemeTokens,
  overrides: Partial<ThemeTokens> | null | undefined
): ThemeTokens {
  return {
    ...base,
    ...(overrides ?? {}),
    name: overrides?.name ?? base.name,
  };
}

export function buildThemeGradient(theme: ThemeTokens) {
  return `linear-gradient(145deg, ${theme.background} 0%, ${theme.backgroundAlt} 52%, ${theme.background} 100%)`;
}
