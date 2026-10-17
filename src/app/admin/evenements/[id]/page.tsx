import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventForAdmin } from "@/server/services/events";
import { expireStaleInvitations, suggestProvidersForEvent } from "@/server/services/invitations";
import { listVenuesForAdmin } from "@/server/services/venues";
import { listAuditForEntity } from "@/server/services/audit";
import { EVENT_TYPE_LABELS, TRI_STATE_LABELS, formatHeadcount } from "@/domain/labels";
import { formatEventWindow, formatInstantParis, toDateOnlyString } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { LabelCard } from "@/components/ui/label-card";
import { DataList } from "@/components/ui/data-list";
import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Flash } from "@/components/admin/flash";
import { AdminSection, Disclosure, HelpText } from "@/components/admin/section";
import { EventStatusBadge, REQUEST_SOURCE_LABELS, TeamStatusBadge } from "@/components/admin/badges";
import { ChecklistSection, EventActionsSection, ProposalsSection, ReadinessList, TeamSection } from "@/components/admin/event-sections";
import { EventDetailsForm } from "@/components/admin/event-details-form";
import { PreparationForm } from "@/components/admin/preparation-form";
import { NotesSection } from "@/components/admin/notes-section";
import { AuditSection } from "@/components/admin/audit-list";

export const metadata: Metadata = { title: "Fiche événement" };

const CLOSED = ["COMPLETED", "CANCELLED", "DECLINED"];

export default async function AdminEventPage({ params, searchParams }: PageProps<"/admin/evenements/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await expireStaleInvitations();
  const event = await getEventForAdmin(id);
  if (!event) notFound();
  const closed = CLOSED.includes(event.status);
  const [candidates, venues, audit] = await Promise.all([closed ? Promise.resolve([]) : suggestProvidersForEvent(id), listVenuesForAdmin(), listAuditForEntity("Event", id)]);
  const path = `/admin/evenements/${id}`;
  const missing = event.readiness.items.filter((item) => !item.done);
  const referralVenue = event.request.referral?.venue ?? null;

  return (
    <>
      <PageHeader
        title={event.title}
        description={formatEventWindow({ date: event.date, startsAt: event.startsAt, endsAt: event.endsAt, startTime: event.startTime, endTime: event.endTime, dateIsFlexible: event.dateIsFlexible })}
        meta={
          <>
            <span className="text-[13px] font-semibold text-clay-700 tabular">{event.reference}</span>
            <EventStatusBadge status={event.status} />
            <TeamStatusBadge status={event.teamStatus} />
            <span className="text-[13px] font-medium text-ink-500 tabular">
              {event.readiness.completed}/{event.readiness.total} éléments complétés
            </span>
          </>
        }
        actions={
          <>
            <LinkButton href={`${path}/brief`} variant="secondary" size="sm">
              Brief de mission
            </LinkButton>
            <LinkButton href="/admin/evenements" variant="ghost" size="sm">
              Tous les événements
            </LinkButton>
          </>
        }
      />

      <Flash searchParams={query} />

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <LabelCard title="Préparation du dossier">
          <p className="mt-1 text-sm text-ink-500">Indicateur d’avancement : éléments connus et manquants, sans prétendre mesurer la sécurité.</p>
          <div className="mt-4">
            <ReadinessList items={event.readiness.items} />
          </div>
        </LabelCard>
        <LabelCard title="Client">
          <p className="mt-1 text-sm text-ink-500">Coordonnées visibles ici uniquement.</p>
          <DataList
            className="mt-4"
            items={[
              { label: "Nom", value: event.client.name },
              {
                label: "Email",
                value: (
                  <a href={`mailto:${event.client.email}`} className="text-sage-800 underline">
                    {event.client.email}
                  </a>
                ),
              },
              { label: "Téléphone", value: event.client.phone ?? "Non renseigné" },
              {
                label: "Origine de la demande",
                value: (
                  <>
                    {REQUEST_SOURCE_LABELS[event.request.source]}
                    {referralVenue ? (
                      <>
                        {" · "}
                        <Link href={`/lieux/${referralVenue.slug}`} className="text-sage-800 underline">
                          {referralVenue.name}
                        </Link>
                      </>
                    ) : null}
                  </>
                ),
              },
              { label: "Demande reçue le", value: formatInstantParis(event.createdAt) },
            ]}
          />
          {event.request.message || event.request.organizerRole ? (
            <Disclosure summary="Message et rôle indiqués à la demande" className="mt-4">
              {event.request.organizerRole ? <p className="text-sm text-ink-500">Rôle : {event.request.organizerRole}</p> : null}
              {event.request.message ? <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-line text-ink-900">{event.request.message}</p> : null}
            </Disclosure>
          ) : null}
        </LabelCard>
      </div>

      <EventActionsSection event={event} />

      <AdminSection id="fiche" title="Date, lieu et effectifs" description={`${EVENT_TYPE_LABELS[event.eventType]} · ${formatHeadcount(event)} · parents sur place : ${TRI_STATE_LABELS[event.parentsOnSite].toLowerCase()}.`}>
        <EventDetailsForm
          eventId={event.id}
          event={{
            eventType: event.eventType,
            date: event.date ? toDateOnlyString(event.date) : null,
            endDate: event.endDate ? toDateOnlyString(event.endDate) : null,
            dateIsFlexible: event.dateIsFlexible,
            dateNote: event.dateNote,
            startTime: event.startTime,
            endTime: event.endTime,
            venueId: event.venueId,
            venueName: event.venueName,
            venueAddressNote: event.venueAddressNote,
            city: event.city,
            postalCode: event.postalCode,
            childrenUnder3: event.childrenUnder3,
            children3to5: event.children3to5,
            children6to10: event.children6to10,
            children11plus: event.children11plus,
            parentsOnSite: event.parentsOnSite,
            dedicatedSpace: event.dedicatedSpace,
            requiredProviders: event.requiredProviders,
          }}
          venues={venues.map((venue) => ({ id: venue.id, name: venue.name, city: venue.city }))}
          staffing={{ suggested: event.staffing.suggested, explanation: event.staffing.explanation, requiresUnder3Study: event.staffing.requiresUnder3Study }}
        />
      </AdminSection>

      <AdminSection id="preparation" title="Préparation" description="Réponses du client sur les points pratiques, modifiables ici après échange.">
        <PreparationForm eventId={event.id} event={{ dedicatedSpace: event.dedicatedSpace, spaceDescription: event.spaceDescription, meetingPoint: event.meetingPoint, onSiteContactName: event.onSiteContactName, onSiteContactPhone: event.onSiteContactPhone, scheduleNotes: event.scheduleNotes }} />
      </AdminSection>

      {event.venue ? (
        <NotesSection
          id="memoire-lieu"
          title={`Mémoire du lieu — ${event.venue.name}`}
          description="Ce que les missions précédentes ont appris sur ce lieu partenaire. Partagé entre tous les événements qui s’y déroulent."
          notes={event.venue.notes}
          target={{ venueId: event.venue.id }}
          returnPath={path}
          emptyLabel="Aucune mémoire pour ce lieu : documentez-le après la mission."
        />
      ) : (
        <AdminSection id="memoire-lieu" title="Mémoire du lieu">
          <HelpText>Rattachez l’événement à un lieu partenaire dans la fiche pour retrouver la mémoire du lieu (accès, contraintes, retours des missions passées).</HelpText>
        </AdminSection>
      )}

      <AdminSection id="besoins" title="Besoins à clarifier" description="Ce qui manque encore avant de pouvoir confirmer sereinement.">
        {missing.length ? (
          <ReadinessList items={missing} />
        ) : (
          <Alert kind="success" role="status">
            Tous les éléments de préparation sont réunis.
          </Alert>
        )}
      </AdminSection>

      <ChecklistSection event={event} />
      <ProposalsSection event={event} />
      <TeamSection event={event} candidates={candidates} />
      <NotesSection notes={event.notes} target={{ eventId: event.id }} returnPath={path} />
      <AuditSection entries={audit} />
    </>
  );
}
