import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVersionForAdmin } from "@/server/services/quotes";
import { getSettings } from "@/server/services/settings";
import { getEnv } from "@/lib/env";
import { QuoteDocument } from "@/components/documents/quote-document";
import { PrintToolbar } from "@/components/documents/print-toolbar";

export const metadata: Metadata = { title: "Proposition" };

export default async function AdminQuoteDocumentPage({ params }: PageProps<"/admin/evenements/[id]/propositions/[versionId]">) {
  const { id, versionId } = await params;
  const [version, settings] = await Promise.all([getVersionForAdmin(versionId), getSettings()]);
  if (!version || version.quote.eventId !== id) notFound();
  const env = getEnv();
  const event = version.quote.event;
  return (
    <div className="-mt-2">
      <PrintToolbar backHref={`/admin/evenements/${id}`} backLabel="Retour à l’événement" />
      <QuoteDocument
        brandName={settings.brandName}
        ownerFirstName={settings.ownerFirstName}
        contactEmail={settings.contactEmail}
        contactPhone={settings.contactPhone}
        demoMode={env.DEMO_MODE}
        version={version}
        event={{ reference: event.reference, title: event.title, date: event.date, startsAt: event.startsAt, endsAt: event.endsAt, startTime: event.startTime, endTime: event.endTime, dateIsFlexible: event.dateIsFlexible, city: event.city, venueName: event.venue?.name ?? event.venueName }}
        clientName={event.client.name}
        acceptedByName={version.acceptedBy?.name ?? null}
      />
    </div>
  );
}
