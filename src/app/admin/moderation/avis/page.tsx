import Link from "next/link";
import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { dateTime } from "@/components/admin/admin-table";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canGlobal } from "@/modules/authorization";
import { listReviewsForModeration } from "@/modules/moderation/application/content-moderation";
import { requireAdminPage } from "../../_lib/admin-page";
import { moderateReviewAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ReviewsModerationPage({ searchParams }: { searchParams: Promise<{ statut?: string; focus?: string }> }) {
  const { actor, twoFactorWarning } = await requireAdminPage("moderation.queue", "/admin/moderation/avis");
  const sp = await searchParams;
  const status = ["pending", "published", "rejected", "hidden"].includes(sp.statut ?? "") ? (sp.statut as "pending" | "published" | "rejected" | "hidden") : undefined;
  const rows = await listReviewsForModeration(actor, { status });
  const canDecide = canGlobal(actor, "moderation.decide");
  return (
    <div className="space-y-6">
      <Link href="/admin/moderation" className="text-sm text-muted-foreground hover:underline">Retour à la modération</Link>
      <PageHeader  title="Avis" description="Publication, masquage ou refus des avis laissés sur les fiches. Un avis masqué ou refusé est notifié à son auteur avec le motif." />
      <TwoFactorBanner show={twoFactorWarning} />
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Filtres">
        {[undefined, "pending", "published", "hidden", "rejected"].map((s) => (
          <Link key={s ?? "all"} href={s ? `/admin/moderation/avis?statut=${s}` : "/admin/moderation/avis"} className={`rounded-full border px-3 py-1 ${status === s ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted"}`}>
            {s ? { pending: "En attente", published: "Publiés", hidden: "Masqués", rejected: "Refusés" }[s] : "Tous"}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState title="Aucun avis" description="Rien à modérer avec ce filtre." />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className={`gap-3 p-5 ${sp.focus === r.id ? "border-primary" : ""}`} id={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{r.authorName}</span> sur <span className="font-medium">{r.professionalName}</span> · {r.rating}/5 · {dateTime(r.createdAt)}
                  </p>
                  <StatusBadge tone={r.status === "published" ? "success" : r.status === "pending" ? "warning" : "danger"}>{r.status}</StatusBadge>
                </div>
                {r.title && <p className="font-medium">{r.title}</p>}
                <p className="whitespace-pre-wrap text-sm">{r.body}</p>
                {r.moderationNote && <p className="text-xs text-muted-foreground">Note de modération : {r.moderationNote}</p>}
                {canDecide && (
                  <ActionForm action={moderateReviewAction} successMessage="Avis mis à jour." className="flex flex-wrap items-center gap-2 space-y-0">
                    <input type="hidden" name="reviewId" value={r.id} />
                    <Input name="note" placeholder="Motif (obligatoire pour masquer/refuser)" className="h-8 flex-1 min-w-56" />
                    {r.status !== "published" && <ActionSubmit size="sm" name="status" value="published">Publier</ActionSubmit>}
                    {r.status !== "hidden" && <ActionSubmit size="sm" variant="outline" name="status" value="hidden">Masquer</ActionSubmit>}
                    {r.status !== "rejected" && <ActionSubmit size="sm" variant="destructive" name="status" value="rejected">Refuser</ActionSubmit>}
                  </ActionForm>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
