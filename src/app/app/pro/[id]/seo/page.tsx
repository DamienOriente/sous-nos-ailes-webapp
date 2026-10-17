import Link from "next/link";
import { notFound } from "next/navigation";
import { SeoAssistant } from "@/components/seo/seo-assistant";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { hasFeature } from "@/modules/billing/application/entitlements";
import { buildSeoReport } from "@/modules/seo/application/seo-service";

/** SEO assistant: score for everyone, full analysis behind `seo.assistant`. */
export default async function SeoAssistantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/pro/${id}/seo`);
  let report;
  try {
    report = await buildSeoReport(actor, id);
  } catch (e) {
    if (isAppError(e) && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
  const unlocked = await hasFeature(actor.userId, "professional", "seo.assistant", id);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Visibilité"
        title="Assistant SEO"
        description="Des règles simples, expliquées : ce que la plateforme a vérifié, ce que nous vous conseillons. Aucune promesse de classement."
        actions={
          <Button asChild variant="outline">
            <Link href={`/app/pro/${id}/page`}>Modifier la page</Link>
          </Button>
        }
      />
      <SeoAssistant report={report} unlocked={unlocked} />
    </div>
  );
}
