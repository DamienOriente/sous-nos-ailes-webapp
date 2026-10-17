import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageRenderer } from "@/components/pages/renderer";
import { Button } from "@/components/ui/button";
import { FONT_PAIRINGS, getTemplate, TEMPLATES } from "@/modules/pages/templates/registry";
import { sampleRenderData, withSampleGallery } from "@/modules/pages/domain/sample-content";

type Params = { key: string };

export function generateStaticParams(): Params[] {
  return TEMPLATES.map((t) => ({ key: t.key }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { key } = await params;
  const t = getTemplate(key);
  if (!t) return { title: "Template introuvable" };
  return { title: `Template « ${t.name} »`, description: t.description };
}

/** Full-size preview of one template with fictitious content, switchable palette via ?palette=. */
export default async function TemplatePreviewPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ palette?: string }> }) {
  const { key } = await params;
  const { palette } = await searchParams;
  const template = getTemplate(key);
  if (!template) notFound();
  const paletteKey = template.palettes.some((p) => p.key === palette) ? palette : template.palettes[0]?.key;
  const base = sampleRenderData(template.key, paletteKey);
  const data = { ...base, content: withSampleGallery(base.content) };
  return (
    <>
      <div className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/templates">
                <ArrowLeft aria-hidden="true" />
                Tous les templates
              </Link>
            </Button>
            <div>
              <p className="font-semibold">
                {template.name} <span className="text-xs font-normal text-muted-foreground">· {template.universe} · {template.isFree ? "inclus dans l'offre gratuite" : "Premium"}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {FONT_PAIRINGS[template.fontPairing].name} · contenu fictif de démonstration
              </p>
            </div>
          </div>
          <nav aria-label="Palettes" className="flex flex-wrap items-center gap-2">
            {template.palettes.map((p) => (
              <Link
                key={p.key}
                href={`/templates/${template.key}?palette=${p.key}`}
                aria-current={p.key === paletteKey ? "true" : undefined}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs aria-[current=true]:border-primary aria-[current=true]:bg-accent"
              >
                <span className="inline-flex overflow-hidden rounded-full border">
                  <span className="size-3" style={{ background: p.light.bg }} />
                  <span className="size-3" style={{ background: p.light.accent }} />
                </span>
                {p.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <PageRenderer data={data} mode="preview" />
    </>
  );
}
