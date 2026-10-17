import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/authz";
import { getVersionForClient } from "@/server/services/quotes";
import { getSettings } from "@/server/services/settings";
import { getEnv } from "@/lib/env";
import { QuoteDocument } from "@/components/documents/quote-document";
import { PrintToolbar } from "@/components/documents/print-toolbar";

export const metadata: Metadata = { title: "Proposition" };

export default async function ClientProposalPage({ params }: PageProps<"/espace-client/evenements/[id]/propositions/[versionId]">) {
  const { id, versionId } = await params;
  const user = await requireUser({ next: `/espace-client/evenements/${id}/propositions/${versionId}` });
  const version = await getVersionForClient(versionId, user.id);
  // The version must belong to the event named in the URL as well as to the client.
  if (!version || version.quote.event.id !== id) notFound();
  const settings = await getSettings();
  const env = getEnv();
  const event = version.quote.event;
  return (
    <div className="flex flex-col gap-2">
      <PrintToolbar backHref={`/espace-client/evenements/${id}`} backLabel="Retour au dossier" />
      <QuoteDocument
        brandName={settings.brandName}
        ownerFirstName={settings.ownerFirstName}
        contactEmail={settings.contactEmail}
        contactPhone={settings.contactPhone}
        demoMode={env.DEMO_MODE}
        version={version}
        event={{
          reference: event.reference,
          title: event.title,
          date: event.date,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          startTime: event.startTime,
          endTime: event.endTime,
          dateIsFlexible: event.dateIsFlexible,
          city: event.city,
          venueName: event.venue?.name ?? event.venueName,
        }}
        clientName={event.client.name}
        acceptedByName={version.acceptedByUserId === user.id ? user.name : null}
      />
    </div>
  );
}
