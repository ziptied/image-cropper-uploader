import type { CSSProperties } from "react";

import type { Theme, ThemeRadius } from "./types";

// indigo-600. indigo-500 (#6366f1) lands at 4.47:1 against white — just under AA.
const DEFAULT_COLOR = "#4f46e5";

/**
 * Text drawn on top of `--icu-color`, picked from that colour's own lightness:
 * white on a dark accent, black on a light one.
 *
 * It has to be done in CSS rather than JS because `color` may be any CSS colour
 * — `var(--brand)`, `hsl(var(--accent))`, a named colour — none of which are
 * reliably parseable before the browser resolves them.
 *
 * A fixed white default fails badly here: it drops below 4.5:1 on any light
 * accent, and dark themes typically pass a *lightened* brand colour.
 *
 * 0.57 is where black overtakes white for WCAG contrast, measured across a hue
 * and chroma sweep rather than guessed. Chroma shifts the true crossover by
 * ±0.02, so colours inside that band land near 4.5:1 whichever way they go —
 * set `theme.foreground` if you need a specific pairing there.
 */
const AUTO_FOREGROUND =
  "oklch(from var(--icu-color) clamp(0, (0.57 - l) * 1000, 1) 0 0)";

/** Small controls / large panels. `full` on a panel would look absurd, so it's capped. */
const RADIUS: Record<ThemeRadius, [string, string]> = {
  none: ["0px", "0px"],
  sm: ["0.375rem", "0.5rem"],
  full: ["9999px", "1.5rem"],
};

/** `color` at `pct` opacity. Every derived tone in the UI is one of these. */
export function tone(color: string, pct: number) {
  return `color-mix(in oklch, ${color} ${pct}%, transparent)`;
}

export type ResolvedTheme = {
  color: string;
  foreground: string;
  /** Set on the component root; children read the vars. */
  vars: CSSProperties;
};

export function resolveTheme(theme: Theme | undefined): ResolvedTheme {
  const color = theme?.color ?? DEFAULT_COLOR;
  const foreground = theme?.foreground ?? AUTO_FOREGROUND;
  const [radius, radiusLg] = RADIUS[theme?.radius ?? "sm"];
  const scheme = theme?.scheme ?? "auto";

  return {
    color,
    foreground,
    vars: {
      // Drives the `Canvas`/`CanvasText` system colours below.
      //
      // "auto" must *omit* the property, not declare `light dark`. Declaring it
      // says "this subtree supports both", which lets the UA re-pick from the OS
      // preference and so overrides an app that set `color-scheme: dark` on
      // :root while the OS is in light mode — leaving dark text on a dark page.
      // Inheriting is what actually follows the page.
      ...(scheme === "auto" ? {} : { colorScheme: scheme }),

      "--icu-color": color,
      "--icu-fg": foreground,
      "--icu-radius": radius,
      "--icu-radius-lg": radiusLg,

      // Surfaces are tints of the base colour over whatever is behind them, so
      // they adapt to light and dark without needing a variant of their own.
      "--icu-tint": tone(color, 6),
      "--icu-tint-strong": tone(color, 12),
      "--icu-line": tone(color, 30),
      "--icu-line-strong": tone(color, 70),

      // Opaque surface + its text. These two must always be set together: a
      // background painted without a matching text colour is exactly how a
      // component ends up unreadable in the theme it wasn't designed in.
      "--icu-surface": "Canvas",
      "--icu-text": "CanvasText",

      // The accent used as *text on the page*, rather than as a fill. Bending it
      // toward the text colour keeps a pale brand colour legible on a light
      // background, and a dark one legible on dark, without shifting its hue.
      //
      // 60% is the highest accent share that holds 4.5:1 in both schemes across
      // a sampled range of brand colours (70% drops to 3.4:1 on lime, 4.1:1 on
      // navy). Measured, not guessed.
      "--icu-accent-text":
        "color-mix(in oklch, var(--icu-color) 60%, CanvasText)",

      // Bends toward the text colour, so it darkens on light and lightens on
      // dark while staying recognisably red.
      "--icu-danger": "color-mix(in oklch, #ef4444 75%, CanvasText)",
    } as CSSProperties,
  };
}
