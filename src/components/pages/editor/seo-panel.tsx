"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProfessionalSnapshot } from "@/modules/pages/domain/render-data";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, generateTitle, TITLE_MAX, TITLE_MIN } from "@/modules/seo/domain/meta";

function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const tone = value === 0 ? "text-muted-foreground" : value < min ? "text-warning-foreground" : value > max ? "text-destructive" : "text-success";
  return (
    <span className={`text-xs tabular-nums ${tone}`} aria-live="polite">
      {value}/{max}
      {value > 0 && value < min ? " · court" : value > max ? " · trop long" : ""}
    </span>
  );
}

/** Title/description with live counters; the full assistant lives on the SEO page. */
export function SeoPanel({ seoTitle, seoDescription, professional, professionalId, onChange }: { seoTitle: string | null; seoDescription: string | null; professional: ProfessionalSnapshot; professionalId: string; onChange: (patch: { seoTitle?: string | null; seoDescription?: string | null }) => void }) {
  const fallbackTitle = generateTitle(professional);
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-title">Titre de la page</Label>
          <Counter value={(seoTitle ?? "").length} min={TITLE_MIN} max={TITLE_MAX} />
        </div>
        <Input id="seo-title" value={seoTitle ?? ""} maxLength={70} placeholder={fallbackTitle} onChange={(e) => onChange({ seoTitle: e.target.value || null })} />
        <p className="text-xs text-muted-foreground">Vide : « {fallbackTitle} » sera utilisé.</p>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="seo-desc">Description</Label>
          <Counter value={(seoDescription ?? "").length} min={DESCRIPTION_MIN} max={DESCRIPTION_MAX} />
        </div>
        <Textarea id="seo-desc" value={seoDescription ?? ""} maxLength={170} rows={4} placeholder="Ce que vous faites, pour qui, où. Une phrase qui donne envie de cliquer." onChange={(e) => onChange({ seoDescription: e.target.value || null })} />
      </div>
      <p className="text-sm text-muted-foreground">
        Suggestions, aperçu Google, analyse des images et état d'indexation :{" "}
        <Link href={`/app/pro/${professionalId}/seo`} className="font-medium text-primary underline-offset-4 hover:underline">
          ouvrir l'assistant SEO
        </Link>
        .
      </p>
    </div>
  );
}
