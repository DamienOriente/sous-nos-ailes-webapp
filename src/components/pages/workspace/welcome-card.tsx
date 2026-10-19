import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { StorefrontScene } from "@/components/illustrations/pro-scenes";
import { TemplateThumbnail } from "@/components/pages/template-thumbnail";
import { Button } from "@/components/ui/button";
import type { PageRenderData } from "@/modules/pages/domain/render-data";
import { getTemplateOrDefault } from "@/modules/pages/templates/registry";

/**
 * Top of the professional dashboard: a welcome scene on the left, a live
 * miniature of the public page on the right (published version when the
 * listing is online, otherwise the draft). The miniature is the real template
 * scaled down, so what the professional sees is what visitors get.
 */
export function WelcomeCard({
  firstName,
  listingName,
  status,
  slug,
  baseHref,
  preview,
}: {
  firstName: string;
  listingName: string;
  status: string;
  slug: string;
  baseHref: string;
  preview: { data: PageRenderData; kind: "published" | "draft"; versionNumber: number } | null;
}) {
  const online = status === "published";
  const template = preview ? getTemplateOrDefault(preview.data.templateKey) : null;
  return (
    <section aria-labelledby="welcome-h" className="grid gap-6 rounded-2xl border bg-card p-5 sm:p-6 lg:grid-cols-[1fr_minmax(0,380px)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <StorefrontScene className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-44" />
        <div>
          <h2 id="welcome-h" className="font-heading text-xl font-semibold sm:text-2xl">
            Bonjour {firstName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            {online
              ? `« ${listingName} » est en ligne dans l'annuaire. Les organisateurs vous trouvent, vous comparent et vous écrivent depuis votre page publique : gardez-la vivante.`
              : `« ${listingName} » n'est pas encore visible. Complétez la fiche, ajoutez des photos et des prestations, puis soumettez-la : notre équipe la relit sous quelques jours.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`${baseHref}/page`}>
                Travailler ma page
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            {online && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/pro/${slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Voir comme un visiteur
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
      {/* The thumbnail renders a real page with its own links: a stretched link covers the card instead of wrapping them. */}
      {preview && template ? (
        <div className="group relative rounded-xl border bg-muted/40 p-2 focus-within:outline-2">
          <TemplateThumbnail templateKey={preview.data.templateKey} data={preview.data} className="aspect-[4/3] w-full overflow-hidden rounded-lg border bg-background" />
          <p className="mt-2 flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
            <span>
              {preview.kind === "published" ? "Page publiée" : "Brouillon"}, version {preview.versionNumber}, {template.name}
            </span>
            <Link
              href={preview.kind === "published" ? `/pro/${slug}` : `${baseHref}/page/apercu`}
              className="text-primary after:absolute after:inset-0 after:rounded-xl group-hover:underline focus-visible:outline-none"
              aria-label={`Aperçu de la ${preview.kind === "published" ? "page publiée" : "page en cours"} (template ${template.name})`}
            >
              Ouvrir
            </Link>
          </p>
        </div>
      ) : null}
    </section>
  );
}
