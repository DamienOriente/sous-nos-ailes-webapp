import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inquiries, professionals } from "@/db/schema";
import { EmptyState, PageHeader, StatusBadge } from "@/components/shared";
import { requireActor } from "@/lib/session";
import { formatDateFr, formatEuros } from "@/lib/utils";
import { requireEventPermission } from "@/modules/authorization";
import { guardPage } from "../_guards";
import { HoldActionButton } from "@/components/brief/hold-buttons";
import { releaseHoldAction } from "@/app/app/options/actions";
import { isHoldLive, listEventHolds } from "@/modules/inquiries/application/hold-service";

const STATUS_LABELS: Record<string, string> = { new: "Envoyée", viewed: "Vue", info_requested: "Infos demandées", quoted: "Devis reçu", accepted: "Acceptée", declined: "Déclinée", confirmed: "Confirmée", archived: "Archivée" };
const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = { new: "info", viewed: "info", info_requested: "warning", quoted: "warning", accepted: "success", declined: "danger", confirmed: "success", archived: "neutral" };
const KIND_LABELS: Record<string, string> = { contact: "Prise de contact", availability: "Disponibilité", quote: "Demande de devis" };

/** Commercial inquiries sent from this event to professionals (read-only here; the conversation lives on the professional side). */
export default async function EventInquiriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/demandes`);
  await guardPage(() => requireEventPermission(actor, id, "event.inquiries.view"));
  const rows = await db
    .select({ id: inquiries.id, kind: inquiries.kind, status: inquiries.status, message: inquiries.message, quoteCents: inquiries.quoteCents, createdAt: inquiries.createdAt, updatedAt: inquiries.updatedAt, proName: professionals.displayName, proSlug: professionals.slug, eventProfessionalId: inquiries.eventProfessionalId })
    .from(inquiries)
    .innerJoin(professionals, eq(professionals.id, inquiries.professionalId))
    .where(eq(inquiries.eventId, id))
    .orderBy(desc(inquiries.createdAt));
  const holds = await listEventHolds(actor, id);
  const quoted = rows.filter((r) => r.quoteCents !== null).length;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes commerciales"
        description="Les demandes de contact, de disponibilité ou de devis envoyées aux professionnels pour cet évènement."
        actions={
          <>
            <Link href={`/app/evenements/${id}/brief`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Envoyer le brief
            </Link>
            {quoted > 1 && (
              <Link href={`/app/evenements/${id}/devis`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Comparer les {quoted} devis
              </Link>
            )}
          </>
        }
      />
      {holds.length > 0 && (
        <section aria-labelledby="holds-h" className="space-y-2">
          <h2 id="holds-h" className="text-lg font-semibold">
            Options posées
          </h2>
          <ul className="divide-y rounded-2xl border bg-card" data-testid="event-holds">
            {holds.map(({ hold, proName, proSlug, requesterName }) => (
              <li key={hold.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/pro/${proSlug}`} className="font-medium hover:underline">
                    {proName}
                  </Link>
                  <p className="text-muted-foreground">
                    {formatDateFr(new Date(`${hold.holdDate}T12:00:00Z`))}, posée par {requesterName}
                    {hold.status === "active" && isHoldLive(hold) ? `, valable jusqu'au ${formatDateFr(hold.expiresAt, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hold.status === "confirmed" ? <StatusBadge tone="success">Date confirmée</StatusBadge> : isHoldLive(hold) ? <StatusBadge tone="info">En attente du professionnel</StatusBadge> : <StatusBadge tone="neutral">Expirée</StatusBadge>}
                  {hold.requesterUserId === actor.userId && (hold.status === "confirmed" || isHoldLive(hold)) && <HoldActionButton run={releaseHoldAction.bind(null, hold.id)} label="Libérer" done="Option libérée." />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rows.length === 0 ? (
        <EmptyState title="Aucune demande" description="Depuis une fiche de l'annuaire, envoyez une demande en précisant cet évènement : elle apparaîtra ici." />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">
                  <Link href={`/pro/${r.proSlug}`} className="hover:underline">
                    {r.proName}
                  </Link>
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{KIND_LABELS[r.kind] ?? r.kind}</span>
                </p>
                <p className="line-clamp-2 text-muted-foreground">{r.message}</p>
                <p className="text-xs text-muted-foreground">
                  Envoyée le {formatDateFr(r.createdAt)}
                  {r.eventProfessionalId && (
                    <>
                      {" · "}
                      <Link href={`/app/evenements/${id}/prestataires/${r.eventProfessionalId}`} className="text-primary hover:underline">
                        fiche prestataire
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {r.quoteCents !== null && <span className="tabular-nums">{formatEuros(r.quoteCents)}</span>}
                <StatusBadge tone={STATUS_TONE[r.status] ?? "neutral"}>{STATUS_LABELS[r.status] ?? r.status}</StatusBadge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
