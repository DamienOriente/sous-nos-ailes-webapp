import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { ReplyExample } from "@/components/pages/workspace/examples";
import { IllustratedEmpty } from "@/components/pages/workspace/illustrated-empty";
import { InquiryStatusBadge } from "@/components/inquiries/inquiry-status-badge";
import { requireActor } from "@/lib/session";
import { cn, formatDateFr } from "@/lib/utils";
import { countInquiriesByStatus, listInquiriesForProfessional } from "@/modules/inquiries/application/inquiry-service";
import { isHoldLive, listHoldsForProfessional } from "@/modules/inquiries/application/hold-service";
import { HoldActionButton } from "@/components/brief/hold-buttons";
import { StatusBadge } from "@/components/shared/status-badge";
import { confirmHoldAction, releaseHoldAction } from "@/app/app/options/actions";
import { INQUIRY_KIND_LABELS, INQUIRY_STATUS_LABELS, INQUIRY_STATUSES, type InquiryStatus } from "@/modules/inquiries/domain/inquiry-status";

export const metadata: Metadata = { title: "Demandes" };

export default async function InquiriesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const actor = await requireActor(`/app/pro/${id}/demandes`);
  const status = (INQUIRY_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as InquiryStatus) : "all";
  const [items, counts, holds] = await Promise.all([listInquiriesForProfessional(actor, id, status), countInquiriesByStatus(actor, id), listHoldsForProfessional(actor, id)]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const base = `/app/pro/${id}/demandes`;
  return (
    <div className="space-y-6">
      <PageHeader title="Demandes" description="Demandes de contact, de disponibilité et de devis reçues depuis votre page publique. Répondez vite : le taux de réponse compte dans votre classement." />
      <nav aria-label="Filtrer par statut" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          <li>
            <Link href={base} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", status === "all" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")} aria-current={status === "all" ? "page" : undefined}>
              Toutes <Badge variant="secondary">{total}</Badge>
            </Link>
          </li>
          {INQUIRY_STATUSES.map((s) => (
            <li key={s}>
              <Link href={`${base}?status=${s}`} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", status === s ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")} aria-current={status === s ? "page" : undefined}>
                {INQUIRY_STATUS_LABELS[s]} <Badge variant="secondary">{counts[s] ?? 0}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {holds.length > 0 && (
        <section id="options" aria-labelledby="options-h" className="space-y-3">
          <h2 id="options-h" className="text-lg font-semibold">
            Options sur vos dates
          </h2>
          <ul className="divide-y rounded-2xl border bg-card" data-testid="holds-list">
            {holds.map(({ hold, requesterName, eventName }) => {
              const live = isHoldLive(hold);
              return (
                <li key={hold.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {formatDateFr(new Date(`${hold.holdDate}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    <p className="text-muted-foreground">
                      {requesterName}
                      {eventName ? `, ${eventName}` : ""}
                      {live ? `. Option valable jusqu'au ${formatDateFr(hold.expiresAt, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {hold.status === "confirmed" ? (
                      <>
                        <StatusBadge tone="success">Date confirmée</StatusBadge>
                        <HoldActionButton run={releaseHoldAction.bind(null, hold.id)} label="Libérer" done="Date libérée." />
                      </>
                    ) : live ? (
                      <>
                        <HoldActionButton run={confirmHoldAction.bind(null, hold.id)} label="Confirmer la date" done="Date confirmée." variant="default" />
                        <HoldActionButton run={releaseHoldAction.bind(null, hold.id)} label="Libérer" done="Option libérée." />
                      </>
                    ) : (
                      <StatusBadge tone="neutral">Option expirée</StatusBadge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {items.length === 0 ? (
        <IllustratedEmpty
          title={status === "all" ? "Aucune demande reçue pour l'instant" : "Aucune demande dans ce statut"}
          description={status === "all" ? "Les demandes envoyées depuis le formulaire de votre page publique arrivent ici, avec une notification et un e-mail. En attendant, préparez votre première réponse : l'exemple ci-dessous vous donne la structure." : "Changez de filtre pour voir les autres demandes."}
        />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card" data-testid="inquiries-list">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`${base}/${i.id}`} className="flex flex-col gap-2 p-4 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">
                    {i.requesterName} <span className="text-xs font-normal text-muted-foreground">· {INQUIRY_KIND_LABELS[i.kind]}</span>
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{[i.eventTypeLabel, i.eventDate, i.eventCity, i.guestsCount ? `${i.guestsCount} invités` : null, i.childrenCount ? `${i.childrenCount} enfants` : null].filter(Boolean).join(" · ")}</p>
                  <p className="line-clamp-1 text-sm">{i.message}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatDateFr(i.createdAt, { day: "numeric", month: "short" })}</span>
                  <InquiryStatusBadge status={i.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ReplyExample />
    </div>
  );
}
