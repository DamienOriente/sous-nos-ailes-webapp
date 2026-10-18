import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { professionals } from "@/db/schema";
import { EventCover, MemberAvatars, ProgressBar } from "@/components/events/event-cover";
import { Countdown } from "@/components/events/event-header";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { ConfettiScene, EmptyNestScene } from "@/components/illustrations";
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

export const metadata: Metadata = { title: "Mes évènements" };

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
    <div className="space-y-6">
      <PageHeader
        title="Mes évènements"
        description="Les évènements que vous organisez et ceux où vous intervenez."
        actions={
          <Button asChild>
            <Link href="/app/evenements/nouveau">Créer un évènement</Link>
          </Button>
        }
      />

      {invitePro && (
        <Card>
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
        all.length === 0 ? (
          <IllustratedEmpty
            scene={ConfettiScene}
            title="Votre premier évènement commence ici"
            description="En quelques questions nous préparons la liste de tâches, le budget par poste, le planning du jour J et la messagerie de l'équipe. Vous pourrez ensuite inviter vos prestataires et vos proches."
            example="Mariage de Louis et Lisa, 12 juin 2027, 120 invités dont 14 enfants"
            action={
              <Button asChild>
                <Link href="/app/evenements/nouveau">Créer mon évènement</Link>
              </Button>
            }
            testId="events-empty"
          />
        ) : (
          <IllustratedEmpty scene={EmptyNestScene} title="Rien dans cette catégorie" description="Changez de filtre pour voir vos autres évènements." compact action={<Button asChild variant="outline"><Link href="/app/evenements">Voir les évènements en cours</Link></Button>} />
        )
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" data-testid="events-grid">
          {list.map((e, i) => {
            const pct = e.totalTasks > 0 ? Math.round((e.doneTasks / e.totalTasks) * 100) : 0;
            return (
              <li key={e.id}>
                <Link href={`/app/evenements/${e.id}`} className="group flex h-full flex-col overflow-hidden rounded-3xl border bg-card transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" data-testid="event-card">
                  <div className="relative">
                    <EventCover event={e} className="aspect-[16/9]" priority={i < 2} sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" width={900} height={506} />
                    <div className="absolute inset-0 bg-black/35" aria-hidden="true" />
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-foreground dark:bg-black/50 dark:text-white">{EVENT_TYPE_LABELS[e.type]}</span>
                      <span className="rounded-full bg-white/90 px-1 py-0.5 dark:bg-black/60">
                        <StatusBadge tone={EVENT_STATUS_TONES[e.status]}>{EVENT_STATUS_LABELS[e.status]}</StatusBadge>
                      </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
                      <h2 className="min-w-0 font-heading text-xl font-semibold text-balance drop-shadow-sm group-hover:underline">{e.name}</h2>
                      <Countdown eventDate={e.eventDate} timezone="Europe/Paris" tentative={e.dateIsTentative} size="md" onPhoto />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>{e.eventDate ? formatDateFr(e.eventDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date à définir"}</li>
                      {(e.venueName || e.city) && <li className="truncate">{[e.venueName, e.city].filter(Boolean).join(" · ")}</li>}
                    </ul>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Préparation · {e.doneTasks}/{e.totalTasks} tâches
                        </span>
                        <span className="tabular-nums">{pct}%</span>
                      </div>
                      <ProgressBar value={e.doneTasks} max={e.totalTasks} label={`Avancement de la préparation : ${pct} %`} />
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                      <MemberAvatars names={e.memberNames} />
                      <span>
                        {e.confirmedProviders} prestataire{e.confirmedProviders > 1 ? "s" : ""} confirmé{e.confirmedProviders > 1 ? "s" : ""} · {EVENT_ROLE_LABELS[e.role as EventRole]}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
