import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEventForAdmin, headcountOf } from "@/server/services/events";
import { getSettings, listAllOptions } from "@/server/services/settings";
import { getEnv } from "@/lib/env";
import { MissionBrief } from "@/components/documents/mission-brief";
import { PrintToolbar } from "@/components/documents/print-toolbar";

export const metadata: Metadata = { title: "Brief de mission" };

export default async function MissionBriefPage({ params }: PageProps<"/admin/evenements/[id]/brief">) {
  const { id } = await params;
  const [event, settings, options] = await Promise.all([getEventForAdmin(id), getSettings(), listAllOptions()]);
  if (!event) notFound();
  const env = getEnv();
  const optionLabels = options.filter((option) => event.optionCodes.includes(option.code)).map((option) => option.label);
  return (
    <div className="-mt-2">
      <PrintToolbar backHref={`/admin/evenements/${id}`} backLabel="Retour à l’événement" />
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
          venueAccessInfo: event.venue?.accessInfo ?? null,
          venueConstraints: event.venue?.constraints ?? null,
          venueChildrenSpaces: event.venue?.childrenSpaces ?? null,
          headcount: headcountOf(event),
          parentsOnSite: event.parentsOnSite,
          dedicatedSpace: event.dedicatedSpace,
          spaceDescription: event.spaceDescription,
          meetingPoint: event.meetingPoint,
          onSiteContactName: event.onSiteContactName,
          onSiteContactPhone: event.onSiteContactPhone,
          scheduleNotes: event.scheduleNotes,
          optionLabels,
        }}
        team={event.activeAssignments.map((assignment) => ({ displayName: assignment.provider.displayName, roleLabel: assignment.roleLabel, phone: assignment.provider.user.phone }))}
        checklist={event.checklist.map((item) => ({ label: item.label, isDone: item.isDone }))}
      />
    </div>
  );
}
