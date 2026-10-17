import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { CalendarDays, CheckSquare, Handshake, MapPin, PartyPopper, Plus, Users } from "lucide-react";
import { db } from "@/db/client";
import { professionals } from "@/db/schema";
import { Countdown } from "@/components/events/event-header";
import { EmptyState, FormMessage, PageHeader, StatusBadge, SubmitButton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActor } from "@/lib/session";
import { cn, formatDateFr } from "@/lib/utils";
import { EVENT_ROLE_LABELS, type EventRole } from "@/modules/authorization";
import { listEventsForActor } from "@/modules/events/application/event-service";
import { EVENT_STATUS_TONES, isEventLive, type EventStatus } from "@/modules/events/domain/event-status";
import { EVENT_STATUS_LABELS, EVENT_TYPE_LABELS } from "@/modules/events/domain/event-types";
import { shortlistAction } from "./actions";

export const metadata: Metadata = { title: "Mes évènements — Sous Nos Ailes" };

const FILTERS: Array<{ key: string; label: string; match: (s: EventStatus) => boolean }> = [
  { key: "actifs", label: "En cours", match: (s) => isEventLive(s) },
  { key: "termines", label: "Terminés", match: (s) => s === "completed" },
  { key: "archives", label: "Annulés & archivés", match: (s) => s === "cancelled" || s === "archived" },
  { key: "tous", label: "Tous", match: () => true },
];

export default async function EventsListPage({ searchParams }: { searchParams: Promise<{ statut?: string; invite?: string; erreur?: string }> }) {
  const { statut, invite, erreur } = await searchParams;
  const actor = await requireActor("/app/evenements");
  const all = await listEventsForActor(actor);
  const filter = FILTERS.find((f) => f.key === statut) ?? FILTERS[0]!;
  const list = all.filter((e) => filter.match(e.status));

  // Directory → "add this professional to one of my events".
  const invitePro = invite && /^[0-9a-f-]{36}$/i.test(invite) ? (await db.select({ id: professionals.id, displayName: professionals.displayName, tagline: professionals.tagline }).from(professionals).where(and(eq(professionals.id, invite), eq(professionals.status, "published"), isNull(professionals.deletedAt))).limit(1))[0] : undefined;
  const manageable = all.filter((e) => isEventLive(e.status) && ["owner", "lead_organizer", "co_organizer", "wedding_planner"].includes(e.role));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Organisation"
        title="Mes évènements"
        description="Les évènements que vous organisez et ceux où vous intervenez."
        actions={
          <Button asChild>
            <Link href="/app/evenements/nouveau">
              <Plus className="size-4" aria-hidden="true" />
              Créer un évènement
            </Link>
          </Button>
        }
      />

      {invitePro && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Ajouter {invitePro.displayName} à un évènement</CardTitle>
            <CardDescription>{invitePro.tagline ?? "Choisissez l'évènement concerné : le professionnel sera présélectionné dans votre liste de prestataires, sans qu'il soit encore contacté."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormMessage error={erreur === "selection" ? "Sélection invalide." : erreur} />
            {manageable.length === 0 ? (
              <EmptyState title="Aucun évènement actif" description="Créez d'abord un évènement pour y ajouter des prestataires." action={<Button asChild><Link href="/app/evenements/nouveau">Créer un évènement</Link></Button>} />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {manageable.map((e) => (
                  <li key={e.id}>
                    <form action={shortlistAction} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                      <input type="hidden" name="eventId" value={e.id} />
                      <input type="hidden" name="professionalId" value={invitePro.id} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{e.name}</span>
                        <span className="text-xs text-muted-foreground">{e.eventDate ? formatDateFr(e.eventDate) : "Date à définir"}</span>
                      </span>
                      <SubmitButton size="sm" pendingLabel="Ajout…">
                        Choisir
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrer par statut">
        {FILTERS.map((f) => {
          const n = all.filter((e) => f.match(e.status)).length;
          const active = f.key === filter.key;
          return (
            <Link
              key={f.key}
              role="tab"
              aria-selected={active}
              href={f.key === "actifs" ? "/app/evenements" : `/app/evenements?statut=${f.key}`}
              className={cn("rounded-full px-3 py-1.5 text-sm font-medium transition-colors", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              {f.label} <span className="tabular-nums opacity-80">({n})</span>
            </Link>
          );
        })}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title={all.length === 0 ? "Aucun évènement pour le moment" : "Rien dans cette catégorie"}
          description={all.length === 0 ? "Créez votre premier évènement : nous préparons la liste de tâches, le budget et la messagerie pour vous." : "Changez de filtre pour voir vos autres évènements."}
          action={
            all.length === 0 ? (
              <Button asChild>
                <Link href="/app/evenements/nouveau">Créer mon évènement</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <li key={e.id}>
              <Link href={`/app/evenements/${e.id}`} className="group flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-primary uppercase">{EVENT_TYPE_LABELS[e.type]}</p>
                    <h2 className="mt-0.5 truncate font-heading text-lg font-semibold group-hover:underline">{e.name}</h2>
                  </div>
                  <StatusBadge tone={EVENT_STATUS_TONES[e.status]}>{EVENT_STATUS_LABELS[e.status]}</StatusBadge>
                </div>
                <Countdown eventDate={e.eventDate} timezone="Europe/Paris" tentative={e.dateIsTentative} size="sm" />
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    {e.eventDate ? formatDateFr(e.eventDate) : "Date à définir"}
                  </li>
                  {(e.venueName || e.city) && (
                    <li className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      <span className="truncate">{[e.venueName, e.city].filter(Boolean).join(" · ")}</span>
                    </li>
                  )}
                </ul>
                <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-3">
                    <span className="inline-flex items-center gap-1" title="Tâches ouvertes">
                      <CheckSquare className="size-3.5" aria-hidden="true" /> {e.openTasks}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Prestataires confirmés">
                      <Handshake className="size-3.5" aria-hidden="true" /> {e.confirmedProviders}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Membres">
                      <Users className="size-3.5" aria-hidden="true" /> {e.members}
                    </span>
                  </span>
                  <span>{EVENT_ROLE_LABELS[e.role as EventRole]}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
