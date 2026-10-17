import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProvider } from "@/server/authz";
import { getMissionBriefForProvider } from "@/server/services/portal-extras";
import { getSettings, listAllOptions } from "@/server/services/settings";
import { getEnv } from "@/lib/env";
import { MissionBrief } from "@/components/documents/mission-brief";
import { PrintToolbar } from "@/components/documents/print-toolbar";

export const metadata: Metadata = { title: "Brief de mission" };

export default async function ProviderMissionBriefPage({ params }: PageProps<"/espace-intervenant/missions/[eventId]/brief">) {
  const { eventId } = await params;
  const { profile } = await requireProvider(`/espace-intervenant/missions/${eventId}/brief`);
  // The brief is reserved to assigned providers; others get the same 404 as an unknown event.
  const data = await getMissionBriefForProvider(eventId, profile.id);
  if (!data) notFound();
  const [settings, options] = await Promise.all([getSettings(), listAllOptions()]);
  const env = getEnv();
  const { event, team } = data;
  const optionLabels = options.filter((option) => event.optionCodes.includes(option.code)).map((option) => option.label);
  return (
    <div className="flex flex-col gap-2">
      <PrintToolbar backHref={`/espace-intervenant/missions/${eventId}`} backLabel="Retour à la mission" />
      <MissionBrief
        brandName={settings.brandName}
        ownerFirstName={settings.ownerFirstName}
        ownerPhone={settings.contactPhone}
        demoMode={env.DEMO_MODE}
        event={{
          reference: event.reference,
          title: event.title,
          eventType: event.eventType,
          date: event.date,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          city: event.city,
          postalCode: event.postalCode,
          venueName: event.venue?.name ?? event.venueName,
          venueAccessInfo: event.venue?.accessInfo,
          venueConstraints: event.venue?.constraints,
          venueChildrenSpaces: event.venue?.childrenSpaces,
          headcount: { childrenUnder3: event.childrenUnder3, children3to5: event.children3to5, children6to10: event.children6to10, children11plus: event.children11plus },
          parentsOnSite: event.parentsOnSite,
          dedicatedSpace: event.dedicatedSpace,
          spaceDescription: event.spaceDescription,
          meetingPoint: event.meetingPoint,
          onSiteContactName: event.onSiteContactName,
          onSiteContactPhone: event.onSiteContactPhone,
          scheduleNotes: event.scheduleNotes,
          optionLabels,
        }}
        team={team}
      />
    </div>
  );
}
