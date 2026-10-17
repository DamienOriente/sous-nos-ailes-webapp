import type { ReactNode } from "react";
import type { EventType, TriState } from "@/generated/prisma/enums";
import { EVENT_TYPE_LABELS, TRI_STATE_LABELS, formatHeadcount } from "@/domain/labels";
import { formatEventWindow } from "@/lib/time";
import type { providerEventView } from "@/server/services/providers";
import { DataList } from "@/components/ui/data-list";

export type ProviderEventView = ReturnType<typeof providerEventView>;
export type FactItem = { label: ReactNode; value: ReactNode };

/**
 * Key/value facts of the operational projection. Before assignment the view
 * carries no postal code, meeting point, contact or free text by construction.
 */
export function providerEventFactItems(view: ProviderEventView): FactItem[] {
  // providerEventView widens enums to string; the source rows are Prisma enums.
  const eventType = view.eventType as EventType;
  const parentsOnSite = view.parentsOnSite as TriState;
  const dedicatedSpace = view.dedicatedSpace as TriState;
  const items: FactItem[] = [
    { label: "Type d’événement", value: EVENT_TYPE_LABELS[eventType] },
    { label: "Date et horaires", value: formatEventWindow({ date: view.date, startsAt: view.startsAt, endsAt: view.endsAt }) },
    { label: "Lieu", value: view.venueName ?? "Lieu à préciser" },
    { label: "Commune", value: view.assigned ? `${view.postalCode} ${view.city}` : view.city },
    { label: "Effectifs par âge", value: formatHeadcount(view.headcount) },
    { label: "Parents sur place", value: TRI_STATE_LABELS[parentsOnSite] },
    { label: "Espace dédié aux enfants", value: TRI_STATE_LABELS[dedicatedSpace] },
  ];
  if (view.assigned) {
    items.push(
      { label: "Point de rendez-vous", value: view.meetingPoint ?? "À confirmer" },
      {
        label: "Contact sur place",
        value: view.onSiteContactName ? `${view.onSiteContactName}${view.onSiteContactPhone ? ` · ${view.onSiteContactPhone}` : ""}` : "À confirmer",
      },
      { label: "Description de l’espace", value: view.spaceDescription ?? "—" },
      { label: "Organisation prévue", value: view.scheduleNotes ? <span className="whitespace-pre-line">{view.scheduleNotes}</span> : "—" },
      { label: "Accès au lieu", value: view.accessInfo ? <span className="whitespace-pre-line">{view.accessInfo}</span> : "—" },
    );
  }
  return items;
}

export function ProviderEventFacts({ view, extra = [], className }: { view: ProviderEventView; extra?: FactItem[]; className?: string }) {
  return <DataList columns={2} className={className} items={[...providerEventFactItems(view), ...extra]} />;
}
