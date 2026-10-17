import type { Metadata } from "next";
import Link from "next/link";
import { EventStatus } from "@/generated/prisma/enums";
import { listEventsForAdmin, type AdminEventFilters } from "@/server/services/events";
import { EVENT_STATUS_LABELS, QUOTE_STATUS_LABELS } from "@/domain/labels";
import { formatEventWindow } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { EventStatusBadge, REQUEST_SOURCE_LABELS, TeamStatusBadge } from "@/components/admin/badges";

export const metadata: Metadata = { title: "Demandes et événements" };

const STATUSES = Object.values(EventStatus);

function parseStatus(value: string | string[] | undefined): AdminEventFilters["status"] {
  if (typeof value !== "string" || !value) return "ACTIVE";
  if (value === "ALL" || value === "ACTIVE") return value;
  return STATUSES.includes(value as EventStatus) ? (value as EventStatus) : "ACTIVE";
}

export default async function AdminEventsPage({ searchParams }: PageProps<"/admin/evenements">) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const teamIncomplete = params.team === "1";
  const events = await listEventsForAdmin({ status, search: search || undefined, teamIncomplete });
  const isFiltered = status !== "ACTIVE" || Boolean(search) || teamIncomplete;

  return (
    <>
      <PageHeader title="Demandes et événements" description="Toutes les demandes reçues et leur avancement commercial et opérationnel." />

      <form method="get" className="grid gap-4 rounded-md border border-sage-200 bg-ivory-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" aria-label="Filtrer les événements">
        <Field label="Statut" htmlFor="filter-status">
          <Select id="filter-status" name="status" defaultValue={status}>
            <option value="ACTIVE">Dossiers en cours</option>
            <option value="ALL">Tous les statuts</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {EVENT_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Recherche" htmlFor="filter-q" help="Référence, titre, commune, nom ou email du client.">
          <Input id="filter-q" name="q" type="search" defaultValue={search} maxLength={120} />
        </Field>
        <div className="flex flex-col gap-3 pb-1 sm:items-start">
          <Checkbox id="filter-team" name="team" value="1" label="Équipe incomplète seulement" defaultChecked={teamIncomplete} />
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" size="sm">
              Filtrer
            </Button>
            {isFiltered ? (
              <LinkButton href="/admin/evenements" variant="ghost" size="sm">
                Réinitialiser
              </LinkButton>
            ) : null}
          </div>
        </div>
      </form>

      {events.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Référence</Th>
              <Th>Titre</Th>
              <Th>Date et horaires</Th>
              <Th>Client</Th>
              <Th>Lieu</Th>
              <Th>Statut</Th>
              <Th>Équipe</Th>
              <Th>Proposition</Th>
              <Th>Origine</Th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <Td className="tabular whitespace-nowrap">
                  <Link href={`/admin/evenements/${event.id}`} className="font-semibold text-sage-800 hover:underline">
                    {event.reference}
                  </Link>
                </Td>
                <Td className="min-w-48">
                  <Link href={`/admin/evenements/${event.id}`} className="hover:underline">
                    {event.title}
                  </Link>
                </Td>
                <Td className="min-w-56 text-ink-700">{formatEventWindow({ date: event.date, startsAt: event.startsAt, endsAt: event.endsAt, startTime: event.startTime, endTime: event.endTime, dateIsFlexible: event.dateIsFlexible })}</Td>
                <Td className="whitespace-nowrap">{event.client.name}</Td>
                <Td className="min-w-40">
                  {event.venue?.name ?? event.venueName ?? <span className="text-ink-500">À préciser</span>}
                  <span className="block text-[13px] text-ink-500">{event.city}</span>
                </Td>
                <Td>
                  <EventStatusBadge status={event.status} />
                </Td>
                <Td>
                  <TeamStatusBadge status={event.teamStatus} />
                  <span className="mt-1 block text-[13px] text-ink-500 tabular">
                    {event.assignments.length}/{event.requiredProviders}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">
                  {event.currentQuote ? (
                    <>
                      <span className="tabular">Version {event.currentQuote.number}</span>
                      <span className="block text-[13px] text-ink-500">{QUOTE_STATUS_LABELS[event.currentQuote.status]}</span>
                    </>
                  ) : (
                    <span className="text-ink-500">Aucune</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-ink-700">{REQUEST_SOURCE_LABELS[event.request.source]}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title={isFiltered ? "Aucun événement ne correspond à ces filtres" : "Aucune demande en cours"} description={isFiltered ? "Élargissez le statut ou videz la recherche." : "Les demandes envoyées depuis le site apparaissent ici."} action={isFiltered ? <LinkButton href="/admin/evenements" variant="secondary">Voir les dossiers en cours</LinkButton> : undefined} />
      )}
    </>
  );
}
