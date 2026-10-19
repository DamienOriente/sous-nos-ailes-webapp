import { describe, expect, it } from "vitest";
import { contrastRatio, mixHex, resolveTheme } from "@/modules/pages/domain/theme";
import { TEMPLATES } from "@/modules/pages/templates/registry";

describe("secondary text contrast on every page background", () => {
  it("meets 4.5:1 on bg, surface and the accent tint, for every palette, both modes", () => {
    for (const t of TEMPLATES) {
      for (const pl of t.palettes) {
        for (const mode of ["light", "dark"] as const) {
          const theme = resolveTheme(t.key, { palette: pl.key });
          const raw = theme.cssVars["--pg-muted"]!;
          const m = /light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)/i.exec(raw)!;
          const muted = mode === "light" ? m[1]! : m[2]!;
          const c = pl[mode];
          for (const bg of [c.bg, c.surface, mixHex(c.bg, c.accent, 0.12)]) expect(contrastRatio(muted, bg), `${t.key}/${pl.key}/${mode}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
