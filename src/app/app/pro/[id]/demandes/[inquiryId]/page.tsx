import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InquiryActions } from "@/components/inquiries/inquiry-actions";
import { InquiryStatusBadge } from "@/components/inquiries/inquiry-status-badge";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { formatDateFr, formatEuros } from "@/lib/utils";
import { privateFileHref } from "@/modules/files/application/file-urls";
import { getInquiryForProfessional, latestQuote } from "@/modules/inquiries/application/inquiry-service";
import { BriefCard } from "@/components/brief/brief-card";
import { readBriefSnapshot } from "@/modules/events/domain/brief";
import { CANCELLATION_LABELS, type CancellationPolicy } from "@/modules/inquiries/domain/quote";
import { INQUIRY_KIND_LABELS, INQUIRY_STATUS_LABELS } from "@/modules/inquiries/domain/inquiry-status";
import { quoteInquiryAction, replyInquiryAction, transitionInquiryAction } from "../actions";

export const metadata: Metadata = { title: "Demande" };

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string; inquiryId: string }> }) {
  const { id, inquiryId } = await params;
  const actor = await requireActor(`/app/pro/${id}/demandes/${inquiryId}`);
  let data;
  try {
    data = await getInquiryForProfessional(actor, id, inquiryId);
  } catch (e) {
    if (isAppError(e) && e.code === "not_found") notFound();
    throw e;
  }
  const { inquiry, history } = data;
  const brief = readBriefSnapshot(inquiry.brief);
  const quote = await latestQuote(inquiryId);
  return (
    <div className="space-y-6">
      <Button asChild variant="link" size="sm" className="px-0">
        <Link href={`/app/pro/${id}/demandes`}>Toutes les demandes</Link>
      </Button>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl" data-testid="inquiry-requester">
                    {inquiry.requesterName}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{INQUIRY_KIND_LABELS[inquiry.kind]} · reçue le {formatDateFr(inquiry.createdAt, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <InquiryStatusBadge status={inquiry.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {brief && <BriefCard brief={brief} title="Brief envoyé par l'organisateur" className="bg-muted/30" />}
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Item label="E-mail" value={<a href={`mailto:${inquiry.requesterEmail}`} className="underline">{inquiry.requesterEmail}</a>} />
                <Item label="Téléphone" value={inquiry.requesterPhone ?? "Non renseigné"} />
                <Item label="Évènement" value={inquiry.eventTypeLabel ?? "Non renseigné"} />
                <Item label="Date" value={inquiry.eventDate ?? "Non renseignée"} />
                <Item label="Ville" value={inquiry.eventCity ?? "Non renseignée"} />
                <Item label="Invités / enfants" value={`${inquiry.guestsCount ?? "n/d"} / ${inquiry.childrenCount ?? "n/d"}`} />
              </dl>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Message</p>
                <p className="whitespace-pre-wrap rounded-xl bg-muted/50 p-4 text-sm" data-testid="inquiry-message">
                  {inquiry.message}
                </p>
              </div>
              {inquiry.quoteCents !== null && (
                <div className="rounded-xl border p-4 text-sm" data-testid="sent-quote">
                  <p className="font-medium">
                    Devis envoyé{quote && quote.version > 1 ? ` (version ${quote.version})` : ""} : {formatEuros(inquiry.quoteCents)}
                  </p>
                  {quote && (
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      {quote.lineItems.length > 0 && <li>{quote.lineItems.map((l) => `${l.quantity > 1 ? `${l.quantity} × ` : ""}${l.label}`).join(", ")}</li>}
                      {quote.inclusions.length > 0 && <li>Inclus : {quote.inclusions.join(", ")}</li>}
                      {quote.exclusions.length > 0 && <li>Non inclus : {quote.exclusions.join(", ")}</li>}
                      <li>
                        Acompte {quote.depositCents > 0 ? formatEuros(quote.depositCents) : "aucun"}, annulation {CANCELLATION_LABELS[quote.cancellationPolicy as CancellationPolicy].label.toLowerCase()}
                        {quote.validUntil ? `, valable jusqu'au ${quote.validUntil}` : ""}
                      </li>
                    </ul>
                  )}
                  {inquiry.quoteNote && <p className="mt-1 text-muted-foreground">{inquiry.quoteNote}</p>}
                  {inquiry.quoteFileId && (
                    <a href={privateFileHref(inquiry.quoteFileId)} className="mt-2 inline-block underline" target="_blank" rel="noreferrer">
                      Ouvrir le devis PDF
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Répondre</CardTitle>
            </CardHeader>
            <CardContent>
              <InquiryActions professionalId={id} inquiryId={inquiryId} status={inquiry.status} replyAction={replyInquiryAction} quoteAction={quoteInquiryAction} transitionAction={transitionInquiryAction} guests={brief?.guests ?? inquiry.guestsCount} />
            </CardContent>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Historique</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="divide-y text-sm">
              {history.map((h) => (
                <li key={h.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-xs text-muted-foreground">{formatDateFr(h.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  {h.toStatus && (
                    <p className="font-medium">{h.fromStatus ? `De « ${INQUIRY_STATUS_LABELS[h.fromStatus]} » à « ${INQUIRY_STATUS_LABELS[h.toStatus]} »` : INQUIRY_STATUS_LABELS[h.toStatus]}</p>
                  )}
                  {h.note && <p className="whitespace-pre-wrap text-muted-foreground">{h.note}</p>}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
