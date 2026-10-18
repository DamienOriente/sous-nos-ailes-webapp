import type { Metadata } from "next";
import Link from "next/link";
import { QuoteAnswerButtons } from "@/components/brief/quote-answer-buttons";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireActor } from "@/lib/session";
import { formatDateFr, formatEuros } from "@/lib/utils";
import { getEventForMember } from "@/modules/events/application/event-service";
import { getEventQuoteComparison } from "@/modules/inquiries/application/inquiry-service";
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUS_TONES, type InquiryStatus } from "@/modules/inquiries/domain/inquiry-status";
import { CANCELLATION_LABELS } from "@/modules/inquiries/domain/quote";
import { guardPage } from "../_guards";
import { answerQuoteAction } from "./actions";

export const metadata: Metadata = { title: "Comparer les devis" };

const MARK = { included: "Inclus", excluded: "Non inclus", unknown: "Non précisé" } as const;

/** Organiser's point of view on the inquiry status. */
const ORGANISER_STATUS: Record<string, string> = { quoted: "Devis reçu", accepted: "Accepté", declined: "Refusé", confirmed: "Réservation confirmée" };

function isoToFr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return formatDateFr(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)), { day: "numeric", month: "long", year: "numeric" }, "UTC");
}

/** Quotes received for the event, side by side and in the same format, one table per trade. */
export default async function EventQuotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/devis`);
  const data = await guardPage(() => getEventQuoteComparison(actor, id));
  const event = await getEventForMember(actor, id);
  const canAnswer = event.access.permissions.has("event.providers.manage");
  return (
    <div className="space-y-8">
      <PageHeader
        title="Comparer les devis"
        description={`Chaque devis est présenté dans le même format : total${data.guests ? ", prix par invité" : ""}, ce qui est inclus, acompte, solde, annulation et validité. Les montants sont TTC.`}
      />
      {data.groups.length === 0 ? (
        <EmptyState
          title="Aucun devis reçu pour l'instant"
          description="Envoyez le brief de l'évènement à plusieurs professionnels : leurs devis arrivent ici, prêts à être comparés."
          action={
            <Link href={`/app/evenements/${id}/brief`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Envoyer le brief
            </Link>
          }
        />
      ) : (
        data.groups.map((g) => {
          const qs = g.comparison.quotes;
          return (
            <section key={g.categorySlug} aria-labelledby={`h-${g.categorySlug}`} className="space-y-3">
              <h2 id={`h-${g.categorySlug}`} className="text-xl font-semibold">
                {g.categoryName}
                <span className="ml-2 text-sm font-normal text-muted-foreground">{qs.length === 1 ? "1 devis" : `${qs.length} devis`}</span>
              </h2>
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full min-w-[40rem] text-sm" data-testid={`quotes-${g.categorySlug}`}>
                  <caption className="sr-only">Devis reçus pour {g.categoryName}, côte à côte</caption>
                  <thead>
                    <tr className="border-b">
                      <th scope="col" className="w-44 p-3 text-left font-medium text-muted-foreground">
                        Critère
                      </th>
                      {qs.map((q) => (
                        <th key={q.inquiryId} scope="col" className="p-3 text-left align-top font-medium">
                          <Link href={`/pro/${g.proSlugs[q.inquiryId]}`} className="font-heading text-base hover:underline">
                            {q.professionalName}
                          </Link>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <StatusBadge tone={INQUIRY_STATUS_TONES[q.status as InquiryStatus] ?? "neutral"}>{ORGANISER_STATUS[q.status] ?? INQUIRY_STATUS_LABELS[q.status as InquiryStatus] ?? q.status}</StatusBadge>
                            {q.cheapest && <StatusBadge tone="success">Le moins cher</StatusBadge>}
                            {q.expired && <StatusBadge tone="warning">Expiré</StatusBadge>}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <th scope="row" className="p-3 text-left font-medium">Total</th>
                      {qs.map((q) => (
                        <td key={q.inquiryId} className="p-3 text-base font-semibold tabular-nums">{formatEuros(q.totalCents)}</td>
                      ))}
                    </tr>
                    {data.guests ? (
                      <tr className="border-b">
                        <th scope="row" className="p-3 text-left font-medium">Par invité</th>
                        {qs.map((q) => (
                          <td key={q.inquiryId} className="p-3 tabular-nums">{q.perGuestCents !== null ? formatEuros(q.perGuestCents) : "Non précisé"}</td>
                        ))}
                      </tr>
                    ) : null}
                    <tr className="border-b">
                      <th scope="row" className="p-3 text-left font-medium">Acompte</th>
                      {qs.map((q) => (
                        <td key={q.inquiryId} className="p-3 tabular-nums">{q.depositCents > 0 ? `${formatEuros(q.depositCents)} (${q.depositPercent} %)` : "Aucun"}</td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <th scope="row" className="p-3 text-left font-medium">Solde</th>
                      {qs.map((q) => (
                        <td key={q.inquiryId} className="p-3">{q.balanceDueDays === null ? "Non précisé" : q.balanceDueDays === 0 ? "Le jour de l'évènement" : `${q.balanceDueDays} jours avant`}</td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <th scope="row" className="p-3 text-left font-medium">Annulation</th>
                      {qs.map((q) => (
                        <td key={q.inquiryId} className="p-3 align-top">
                          <span className="font-medium">{CANCELLATION_LABELS[q.cancellationPolicy].label}</span>
                          <p className="text-xs text-muted-foreground text-pretty">{q.cancellationPolicy === "custom" ? q.cancellationTerms : CANCELLATION_LABELS[q.cancellationPolicy].description}</p>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <th scope="row" className="p-3 text-left font-medium">Valable jusqu'au</th>
                      {qs.map((q) => (
                        <td key={q.inquiryId} className="p-3">{q.validUntil ? isoToFr(q.validUntil) : "Non précisé"}</td>
                      ))}
                    </tr>
                    {g.comparison.items.map((item) => (
                      <tr key={item} className="border-b">
                        <th scope="row" className="p-3 text-left font-normal">{item}</th>
                        {g.comparison.matrix[item]?.map((m, i) => (
                          <td key={qs[i]?.inquiryId ?? i} className={m === "included" ? "p-3 font-medium" : m === "excluded" ? "p-3" : "p-3 text-muted-foreground"}>
                            {MARK[m]}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-b">
                      <th scope="row" className="p-3 text-left font-medium">Détail</th>
                      {qs.map((q) => (
                        <td key={q.inquiryId} className="p-3 align-top text-xs">
                          {q.lineItems.length ? (
                            <ul className="space-y-0.5">
                              {q.lineItems.map((l, i) => (
                                <li key={i} className="tabular-nums">
                                  {l.quantity > 1 ? `${l.quantity} × ` : ""}
                                  {l.label} : {formatEuros(l.quantity * l.unitCents)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground">Montant global</span>
                          )}
                          {q.note && <p className="mt-2 text-muted-foreground text-pretty">{q.note}</p>}
                        </td>
                      ))}
                    </tr>
                    {canAnswer && (
                      <tr>
                        <th scope="row" className="p-3 text-left font-medium">Réponse</th>
                        {qs.map((q) => (
                          <td key={q.inquiryId} className="p-3">
                            {q.status === "quoted" ? (
                              <QuoteAnswerButtons name={q.professionalName} accept={answerQuoteAction.bind(null, id, q.inquiryId, "accepted")} decline={answerQuoteAction.bind(null, id, q.inquiryId, "declined")} />
                            ) : (
                              <span className="text-muted-foreground">{ORGANISER_STATUS[q.status] ?? INQUIRY_STATUS_LABELS[q.status as InquiryStatus]}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
