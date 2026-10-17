import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVersionForAdmin } from "@/server/services/quotes";
import { formatEuros } from "@/lib/money";
import { formatEventWindow, toDateOnlyString } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { Flash } from "@/components/admin/flash";
import { QuoteStatusBadge } from "@/components/admin/badges";
import { QuoteEditor } from "@/components/admin/quote-editor";

export const metadata: Metadata = { title: "Modifier la proposition" };

export default async function QuoteEditorPage({ params, searchParams }: PageProps<"/admin/evenements/[id]/propositions/[versionId]/modifier">) {
  const [{ id, versionId }, query] = await Promise.all([params, searchParams]);
  const version = await getVersionForAdmin(versionId);
  if (!version || version.quote.eventId !== id) notFound();
  const event = version.quote.event;
  const eventHref = `/admin/evenements/${id}`;
  return (
    <>
      <PageHeader
        title={`Proposition — version ${version.number}`}
        description={`${event.reference} · ${event.title} · ${formatEventWindow({ date: event.date, startsAt: event.startsAt, endsAt: event.endsAt, startTime: event.startTime, endTime: event.endTime, dateIsFlexible: event.dateIsFlexible })} · pour ${event.client.name}`}
        meta={
          <>
            <QuoteStatusBadge status={version.status} />
            <span className="text-[13px] font-medium text-ink-500 tabular">Total enregistré : {formatEuros(version.totalInclVatCents)}</span>
          </>
        }
      />
      <Flash searchParams={query} />
      <QuoteEditor
        eventId={id}
        versionId={versionId}
        version={{
          number: version.number,
          status: version.status,
          title: version.title,
          introText: version.introText,
          validUntil: version.validUntil ? toDateOnlyString(version.validUntil) : null,
          vatMode: version.vatMode,
          vatRateBps: version.vatRateBps,
          lines: version.lines.map((line) => ({ kind: line.kind, label: line.label, description: line.description, quantityHundredths: line.quantityHundredths, unitPriceCents: line.unitPriceCents })),
        }}
        previewHref={`${eventHref}/propositions/${versionId}`}
        eventHref={eventHref}
      />
    </>
  );
}
