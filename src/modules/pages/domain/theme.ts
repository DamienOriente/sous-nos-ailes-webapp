import { FONT_PAIRINGS, getTemplateOrDefault, type FontPairingKey, type Palette, type PaletteColors, type TemplateDefinition } from "@/modules/pages/templates/registry";
import type { PageTheme, RadiusOption } from "./page-schema";

/**
 * Turns (template, theme overrides) into CSS custom properties. Light and dark
 * values are combined with `light-dark()` so the page follows the site's
 * colour scheme without a stylesheet per palette. Every value comes from the
 * registry or from a validated hex colour: nothing user-controlled reaches the
 * style attribute unparsed.
 */
export type ResolvedTheme = {
  template: TemplateDefinition;
  palette: Palette;
  fontPairing: FontPairingKey;
  radius: RadiusOption;
  accent: string | null;
  cssVars: Record<`--${string}`, string>;
};

const RADIUS_PX: Record<RadiusOption, { sm: string; md: string; lg: string; xl: string }> = {
  sharp: { sm: "0px", md: "0px", lg: "2px", xl: "4px" },
  soft: { sm: "6px", md: "10px", lg: "16px", xl: "24px" },
  round: { sm: "12px", md: "18px", lg: "28px", xl: "40px" },
};

/** Relative luminance (WCAG) of a #rrggbb colour. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((c) => {
    const v = parseInt(c ?? "00", 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Text colour (near-white or near-black) that reads on the given accent. */
export function contrastColorFor(hex: string): string {
  return contrastRatio(hex, "#ffffff") >= contrastRatio(hex, "#161616") ? "#ffffff" : "#161616";
}

function applyAccent(colors: PaletteColors, accent: string | null): PaletteColors {
  if (!accent) return colors;
  return { ...colors, accent, accentContrast: contrastColorFor(accent) };
}

export function resolveTheme(templateKey: string, theme: PageTheme | null | undefined): ResolvedTheme {
  const template = getTemplateOrDefault(templateKey);
  const palette = template.palettes.find((pl) => pl.key === theme?.palette) ?? (template.palettes[0] as Palette);
  const fontPairing: FontPairingKey = theme?.fontPairing && template.fontPairings.includes(theme.fontPairing as FontPairingKey) ? (theme.fontPairing as FontPairingKey) : template.fontPairing;
  const radius = theme?.radius ?? template.radius;
  const accent = theme?.accent ?? null;
  const light = applyAccent(palette.light, accent);
  const dark = applyAccent(palette.dark, accent);
  const fonts = FONT_PAIRINGS[fontPairing];
  const r = RADIUS_PX[radius];
  const ld = (k: keyof PaletteColors) => `light-dark(${light[k]}, ${dark[k]})`;
  return {
    template,
    palette,
    fontPairing,
    radius,
    accent,
    cssVars: {
      "--pg-bg": ld("bg"),
      "--pg-surface": ld("surface"),
      "--pg-text": ld("text"),
      "--pg-muted": ld("muted"),
      "--pg-accent": ld("accent"),
      "--pg-accent-contrast": ld("accentContrast"),
      "--pg-border": ld("border"),
      "--pg-font-heading": fonts.heading,
      "--pg-font-body": fonts.body,
      "--pg-radius-sm": r.sm,
      "--pg-radius-md": r.md,
      "--pg-radius-lg": r.lg,
      "--pg-radius-xl": r.xl,
    },
  };
}

/** AA check used by the SEO/quality assistant: body text on background, both modes. */
export function paletteContrastIssues(palette: Palette, accent: string | null): string[] {
  const issues: string[] = [];
  for (const mode of ["light", "dark"] as const) {
    const c = applyAccent(palette[mode], accent);
    if (contrastRatio(c.text, c.bg) < 4.5) issues.push(`Contraste texte/fond insuffisant en mode ${mode === "light" ? "clair" : "sombre"}.`);
    if (contrastRatio(c.accentContrast, c.accent) < 4.5) issues.push(`Contraste des boutons insuffisant en mode ${mode === "light" ? "clair" : "sombre"}.`);
  }
  return issues;
}
