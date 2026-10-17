import { formatEuros } from "@/lib/money";
import { formatDateOnlyLong, formatEventWindow, formatInstantParis } from "@/lib/time";
import { formatHoursFromHundredths } from "@/domain/pricing";
import { QUOTE_STATUS_LABELS } from "@/domain/labels";
import type { QuoteLineKind, QuoteVersionStatus, VatMode } from "@/generated/prisma/enums";

export type QuoteDocumentProps = {
  brandName: string;
  ownerFirstName: string;
  contactEmail: string;
  contactPhone?: string | null;
  demoMode: boolean;
  version: {
    number: number;
    status: QuoteVersionStatus;
    title: string;
    introText: string | null;
    validUntil: Date | null;
    vatMode: VatMode;
    vatRateBps: number;
    subtotalCents: number;
    discountCents: number;
    totalExclVatCents: number;
    vatCents: number;
    totalInclVatCents: number;
    sentAt: Date | null;
    acceptedAt: Date | null;
    createdAt: Date;
    lines: Array<{ id: string; kind: QuoteLineKind; label: string; description: string | null; quantityHundredths: number; unitPriceCents: number; totalCents: number }>;
  };
  event: { reference: string; title: string; date: Date | null; startsAt: Date | null; endsAt: Date | null; startTime: string | null; endTime: string | null; dateIsFlexible: boolean; city: string; venueName: string | null };
  clientName: string;
  acceptedByName?: string | null;
};

function quantityLabel(line: QuoteDocumentProps["version"]["lines"][number]): string {
  if (line.kind === "SERVICE") return `${formatHoursFromHundredths(line.quantityHundredths)} cumulées`;
  if (line.kind === "SURCHARGE" && line.quantityHundredths !== 100) return `${formatHoursFromHundredths(line.quantityHundredths)} cumulées`;
  if (line.quantityHundredths === 100) return "1";
  return (line.quantityHundredths / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

/** Printable proposal. Shared by Marie's space and the client space. */
export function QuoteDocument({ brandName, ownerFirstName, contactEmail, contactPhone, demoMode, version, event, clientName, acceptedByName }: QuoteDocumentProps) {
  return (
    <article className="mx-auto w-full max-w-3xl bg-white px-6 py-10 text-ink-900 shadow-card print:max-w-none print:px-0 print:py-0 print:shadow-none sm:px-12 sm:py-14">
      <header className="flex flex-col gap-6 border-b border-sage-200 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-display text-2xl text-sage-800">{brandName}</p>
          <p className="mt-1 text-sm text-ink-500">
            {ownerFirstName} · {contactEmail}
            {contactPhone ? ` · ${contactPhone}` : ""}
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-500">Référence</dt>
          <dd className="font-semibold tabular">{event.reference}</dd>
          <dt className="text-ink-500">Version</dt>
          <dd className="font-semibold tabular">{version.number}</dd>
          <dt className="text-ink-500">Établie le</dt>
          <dd className="tabular">{formatInstantParis(version.sentAt ?? version.createdAt)}</dd>
          {version.validUntil ? (
            <>
              <dt className="text-ink-500">Valable jusqu’au</dt>
              <dd className="tabular">{formatDateOnlyLong(version.validUntil)}</dd>
            </>
          ) : null}
          <dt className="text-ink-500">Statut</dt>
          <dd>{QUOTE_STATUS_LABELS[version.status]}</dd>
        </dl>
      </header>

      {demoMode ? <p className="mt-6 rounded-sm border border-clay-200 bg-clay-100 px-3 py-2 text-[13px] text-clay-800">Document de démonstration : montants fictifs, paramètres non configurés pour une exploitation réelle.</p> : null}

      <section className="mt-8">
        <h1 className="font-display text-[1.75rem] leading-tight">{version.title}</h1>
        <dl className="mt-5 grid gap-x-8 gap-y-2 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-[13px] font-semibold text-ink-500">Pour</dt>
            <dd>{clientName}</dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold text-ink-500">Événement</dt>
            <dd>{event.title}</dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold text-ink-500">Date et horaires</dt>
            <dd>{formatEventWindow({ date: event.date, startsAt: event.startsAt, endsAt: event.endsAt, startTime: event.startTime, endTime: event.endTime, dateIsFlexible: event.dateIsFlexible })}</dd>
          </div>
          <div>
            <dt className="text-[13px] font-semibold text-ink-500">Lieu</dt>
            <dd>
              {event.venueName ? `${event.venueName}, ` : ""}
              {event.city}
            </dd>
          </div>
        </dl>
        {version.introText ? <p className="mt-6 text-[15px] leading-relaxed text-ink-700">{version.introText}</p> : null}
      </section>

      <table className="mt-8 w-full border-collapse text-[15px]">
        <thead>
          <tr className="border-b border-sage-300 text-left text-[13px] font-semibold text-ink-500">
            <th scope="col" className="py-2 pr-3">Désignation</th>
            <th scope="col" className="py-2 pr-3 text-right">Quantité</th>
            <th scope="col" className="py-2 pr-3 text-right">Prix unitaire</th>
            <th scope="col" className="py-2 text-right">Montant</th>
          </tr>
        </thead>
        <tbody>
          {version.lines.map((line) => (
            <tr key={line.id} className="border-b border-sage-100 align-top">
              <td className="py-3 pr-3">
                <p className="font-medium">{line.label}</p>
                {line.description ? <p className="mt-0.5 text-[13px] text-ink-500">{line.description}</p> : null}
              </td>
              <td className="py-3 pr-3 text-right tabular whitespace-nowrap">{quantityLabel(line)}</td>
              <td className="py-3 pr-3 text-right tabular whitespace-nowrap">{formatEuros(line.unitPriceCents)}</td>
              <td className="py-3 text-right tabular whitespace-nowrap">{formatEuros(line.totalCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-[15px]">
          {version.discountCents > 0 ? (
            <>
              <tr>
                <td colSpan={3} className="py-2 text-right text-ink-500">Sous-total</td>
                <td className="py-2 text-right tabular">{formatEuros(version.subtotalCents)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="py-2 text-right text-ink-500">Remise</td>
                <td className="py-2 text-right tabular">− {formatEuros(version.discountCents)}</td>
              </tr>
            </>
          ) : null}
          {version.vatMode === "STANDARD" ? (
            <>
              <tr>
                <td colSpan={3} className="py-2 text-right text-ink-500">Total HT</td>
                <td className="py-2 text-right tabular">{formatEuros(version.totalExclVatCents)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="py-2 text-right text-ink-500">TVA ({(version.vatRateBps / 100).toLocaleString("fr-FR")} %)</td>
                <td className="py-2 text-right tabular">{formatEuros(version.vatCents)}</td>
              </tr>
              <tr className="border-t border-sage-300 font-semibold">
                <td colSpan={3} className="py-3 text-right">Total TTC</td>
                <td className="py-3 text-right tabular">{formatEuros(version.totalInclVatCents)}</td>
              </tr>
            </>
          ) : (
            <tr className="border-t border-sage-300 font-semibold">
              <td colSpan={3} className="py-3 text-right">Total</td>
              <td className="py-3 text-right tabular">{formatEuros(version.totalInclVatCents)}</td>
            </tr>
          )}
        </tfoot>
      </table>
      {version.vatMode === "NONE" ? <p className="mt-2 text-[13px] text-ink-500">Mode de TVA « aucune » configuré dans les paramètres : le régime applicable (franchise ou assujettissement) reste à confirmer avant toute exploitation réelle.</p> : null}

      <section className="mt-10 border-t border-sage-200 pt-6 text-[13px] leading-relaxed text-ink-500">
        {version.status === "ACCEPTED" && version.acceptedAt ? (
          <p className="mb-3 font-semibold text-sage-800">
            Accord de principe donné le {formatInstantParis(version.acceptedAt)}
            {acceptedByName ? ` par ${acceptedByName}` : ""}. Il ne s’agit pas d’une signature électronique certifiée.
          </p>
        ) : null}
        <p>Cette proposition décrit une organisation et des montants établis à partir des informations connues à la date indiquée. Elle ne vaut pas réservation : la prestation est confirmée par {ownerFirstName} une fois l’équipe constituée et les points opérationnels validés.</p>
        <p className="mt-2">Aucune information nominative ou médicale concernant les enfants n’est collectée dans ce cadre.</p>
      </section>
    </article>
  );
}
