import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageRenderer } from "@/components/pages/renderer";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { getDraft } from "@/modules/pages/application/page-service";

/** Full-screen preview of the draft, exactly as the template renders it (inquiry form shown as a placeholder). */
export default async function DraftPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/pro/${id}/page/apercu`);
  let state;
  try {
    state = await getDraft(actor, id);
  } catch (e) {
    if (isAppError(e) && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8" data-testid="draft-preview">
      <div className="sticky top-14 z-30 flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-2 text-sm backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/app/pro/${id}/page`}>
              <ArrowLeft aria-hidden="true" />
              Retour à l'éditeur
            </Link>
          </Button>
          <p className="text-muted-foreground">
            Aperçu du brouillon · version {state.draft.versionNumber}
            {state.published ? ` · version publiée : ${state.published.versionNumber}` : " · aucune version publiée"}
          </p>
        </div>
        {state.published && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/pro/${state.slug}`} target="_blank" rel="noopener">
              Voir la page publiée
            </Link>
          </Button>
        )}
      </div>
      <PageRenderer data={state.renderData} mode="preview" />
    </div>
  );
}
