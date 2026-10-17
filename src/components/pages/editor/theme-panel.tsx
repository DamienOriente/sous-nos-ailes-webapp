"use client";

import { Paywall } from "@/components/billing/paywall";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RADIUS_OPTIONS, type PageTheme, type RadiusOption } from "@/modules/pages/domain/page-schema";
import { FONT_PAIRINGS } from "@/modules/pages/templates/registry";
import type { TemplateSummary } from "./types";

const RADIUS_LABELS: Record<RadiusOption, string> = { sharp: "Angles vifs", soft: "Angles doux", round: "Très arrondi" };

/** Palette choice is free; accent colour, font pairing and radius are the advanced customisation (Premium). */
export function ThemePanel({ template, theme, canCustomize, professionalId, onChange }: { template: TemplateSummary; theme: PageTheme; canCustomize: boolean; professionalId: string; onChange: (t: PageTheme) => void }) {
  const current = theme.palette ?? template.palettes[0]?.key;
  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Palette</legend>
        <div className="grid grid-cols-2 gap-2">
          {template.palettes.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={p.key === current}
              onClick={() => onChange({ ...theme, palette: p.key })}
              className={cn("flex items-center gap-3 rounded-lg border p-2 text-left text-sm hover:bg-muted/60", p.key === current && "border-primary ring-2 ring-primary/20")}
              data-testid={`palette-${p.key}`}
            >
              <span className="inline-flex overflow-hidden rounded-md border">
                <span className="size-6" style={{ background: p.bg }} />
                <span className="size-6" style={{ background: p.accent }} />
                <span className="size-6" style={{ background: p.text }} />
              </span>
              {p.name}
            </button>
          ))}
        </div>
      </fieldset>

      {canCustomize ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="theme-accent">Couleur d'accent</Label>
            <div className="flex items-center gap-2">
              <input id="theme-accent" type="color" value={theme.accent ?? "#5b7a62"} onChange={(e) => onChange({ ...theme, accent: e.target.value })} className="size-9 cursor-pointer rounded-md border bg-transparent p-0.5" />
              <Input aria-label="Code hexadécimal" value={theme.accent ?? ""} placeholder="#rrggbb (palette par défaut)" maxLength={7} onChange={(e) => onChange({ ...theme, accent: /^#[0-9a-fA-F]{6}$/.test(e.target.value) ? e.target.value : undefined })} className="w-40" />
            </div>
            <p className="text-xs text-muted-foreground">Le texte des boutons s'adapte automatiquement pour rester lisible.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="theme-font">Caractères</Label>
            <Select value={theme.fontPairing ?? template.fontPairings[0]} onValueChange={(v) => onChange({ ...theme, fontPairing: v })}>
              <SelectTrigger id="theme-font" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {template.fontPairings.map((k) => (
                  <SelectItem key={k} value={k}>
                    {FONT_PAIRINGS[k].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="theme-radius">Arrondis</Label>
            <Select value={theme.radius ?? template.radius} onValueChange={(v) => onChange({ ...theme, radius: v as RadiusOption })}>
              <SelectTrigger id="theme-radius" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RADIUS_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {RADIUS_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <Paywall feature="customization.advanced" audience="professional" description="Choisissez votre couleur d'accent, l'association de caractères et le style des arrondis pour que la page porte votre identité." backHref={`/app/pro/${professionalId}/page`} backLabel="Garder la palette" />
      )}
    </div>
  );
}
