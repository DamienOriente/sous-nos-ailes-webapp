import { notFound } from "next/navigation";
import { PageBuilder } from "@/components/pages/editor/page-builder";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { getDraft } from "@/modules/pages/application/page-service";
import { TEMPLATES } from "@/modules/pages/templates/registry";

/**
 * Page builder. All data is loaded here (draft, published state, entitlements,
 * render data) and handed to the client editor; every mutation goes back
 * through the server actions next to this file.
 */
export default async function PageBuilderRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/pro/${id}/page`);
  let state;
  try {
    state = await getDraft(actor, id);
  } catch (e) {
    if (isAppError(e) && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
  const templates = TEMPLATES.map((t) => ({
    key: t.key,
    name: t.name,
    universe: t.universe,
    description: t.description,
    isFree: t.isFree,
    palettes: t.palettes.map((p) => ({ key: p.key, name: p.name, bg: p.light.bg, accent: p.light.accent, text: p.light.text })),
    fontPairings: t.fontPairings,
    radius: t.radius,
  }));
  return <PageBuilder professionalId={id} initial={state} templates={templates} />;
}
