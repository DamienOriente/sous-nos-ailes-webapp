import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { InquiryStatusBadge } from "@/components/inquiries/inquiry-status-badge";
import { requireActor } from "@/lib/session";
import { cn, formatDateFr } from "@/lib/utils";
import { countInquiriesByStatus, listInquiriesForProfessional } from "@/modules/inquiries/application/inquiry-service";
import { INQUIRY_KIND_LABELS, INQUIRY_STATUS_LABELS, INQUIRY_STATUSES, type InquiryStatus } from "@/modules/inquiries/domain/inquiry-status";

export const metadata: Metadata = { title: "Demandes" };

export default async function InquiriesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const actor = await requireActor(`/app/pro/${id}/demandes`);
  const status = (INQUIRY_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as InquiryStatus) : "all";
  const [items, counts] = await Promise.all([listInquiriesForProfessional(actor, id, status), countInquiriesByStatus(actor, id)]);
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
      {items.length === 0 ? (
        <EmptyState icon={Inbox} title={status === "all" ? "Aucune demande reçue" : "Aucune demande dans ce statut"} description="Les demandes envoyées depuis le formulaire de votre page publique arrivent ici, avec une notification et un e-mail." />
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
    </div>
  );
}
