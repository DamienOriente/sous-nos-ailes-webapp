import Link from "next/link";
import { ArrowRight, Bell, CalendarDays, PartyPopper, Plus, Search, Store } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { formatDateFr } from "@/lib/utils";
import { EVENT_ROLE_LABELS, type EventRole } from "@/modules/authorization";
import type { HomeDashboard } from "@/modules/identity/application/home-dashboard";

const EVENT_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  planning: { label: "En préparation", tone: "info" },
  confirmed: { label: "Confirmé", tone: "success" },
  in_progress: { label: "En cours", tone: "primary" },
  completed: { label: "Terminé", tone: "neutral" },
};
const PRO_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Brouillon", tone: "neutral" },
  pending_review: { label: "En relecture", tone: "warning" },
  changes_requested: { label: "Modifications demandées", tone: "warning" },
  approved: { label: "Validée", tone: "success" },
  published: { label: "Publiée", tone: "success" },
  suspended: { label: "Suspendue", tone: "danger" },
  rejected: { label: "Refusée", tone: "danger" },
  archived: { label: "Archivée", tone: "neutral" },
};

export function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Button asChild variant="outline" className="h-auto justify-start gap-3 px-4 py-3">
        <Link href="/app/evenements/nouveau">
          <Plus className="text-primary" aria-hidden="true" />
          <span className="text-left">
            <span className="block font-medium">Créer un évènement</span>
            <span className="block text-xs text-muted-foreground">Mariage, baptême, séminaire…</span>
          </span>
        </Link>
      </Button>
      <Button asChild variant="outline" className="h-auto justify-start gap-3 px-4 py-3">
        <Link href="/onboarding/professionnel">
          <Store className="text-primary" aria-hidden="true" />
          <span className="text-left">
            <span className="block font-medium">Créer ma fiche pro</span>
            <span className="block text-xs text-muted-foreground">Apparaître dans l'annuaire</span>
          </span>
        </Link>
      </Button>
      <Button asChild variant="outline" className="h-auto justify-start gap-3 px-4 py-3">
        <Link href="/annuaire">
          <Search className="text-primary" aria-hidden="true" />
          <span className="text-left">
            <span className="block font-medium">Rechercher un professionnel</span>
            <span className="block text-xs text-muted-foreground">Garde d'enfants, traiteur, lieu…</span>
          </span>
        </Link>
      </Button>
    </div>
  );
}

export function WelcomeState() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-primary/20 bg-accent/30">
        <CardHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PartyPopper className="size-5" aria-hidden="true" />
          </div>
          <h2 className="font-heading text-xl leading-snug font-medium">Vous préparez un évènement ?</h2>
          <CardDescription className="text-pretty">Créez votre espace, invitez vos coorganisateurs et trouvez les bons professionnels, garde d'enfants comprise.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/app/evenements/nouveau">
              Créer mon évènement <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
      <Card className="border-secondary/40 bg-secondary/20">
        <CardHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Store className="size-5" aria-hidden="true" />
          </div>
          <h2 className="font-heading text-xl leading-snug font-medium">Vous proposez vos services ?</h2>
          <CardDescription className="text-pretty">Publiez votre fiche dans l'annuaire, recevez des demandes de contact et de devis, gérez vos interventions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="secondary">
            <Link href="/onboarding/professionnel">
              Créer ma fiche pro <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function UpcomingEvents({ events, timezone }: { events: HomeDashboard["upcomingEvents"]; timezone: string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg leading-snug font-medium">Mes prochains évènements</h2>
          <CardDescription>Ceux où vous êtes membre actif.</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/evenements">Tout voir</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Aucun évènement à venir" description="Créez votre premier évènement ou acceptez une invitation." action={<Button asChild size="sm"><Link href="/app/evenements/nouveau">Créer un évènement</Link></Button>} className="py-8" />
        ) : (
          <ul className="divide-y">
            {events.map((ev) => {
              const status = EVENT_STATUS[ev.status] ?? { label: ev.status, tone: "neutral" as StatusTone };
              return (
                <li key={ev.id}>
                  <Link href={`/app/evenements/${ev.id}`} className="flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-muted/60">
                    <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      {ev.eventDate ? (
                        <>
                          <span className="text-base font-semibold leading-none tabular-nums">{formatDateFr(ev.eventDate, { day: "numeric" }, timezone)}</span>
                          <span className="text-[11px] uppercase">{formatDateFr(ev.eventDate, { month: "short" }, timezone).replace(".", "")}</span>
                        </>
                      ) : (
                        <CalendarDays className="size-5" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{ev.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {EVENT_ROLE_LABELS[ev.role as EventRole] ?? ev.role}
                        {ev.city ? ` · ${ev.city}` : ""}
                        {ev.eventDate && ev.dateIsTentative ? " · date à confirmer" : ""}
                      </p>
                    </div>
                    <StatusBadge tone={status.tone} className="hidden sm:inline-flex">
                      {status.label}
                    </StatusBadge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function MyProfessionals({ items }: { items: HomeDashboard["professionals"] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg leading-snug font-medium">Mes fiches pro</h2>
          <CardDescription>Vos activités présentes dans l'annuaire.</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/pro">Tout voir</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={Store} title="Aucune fiche professionnelle" description="Présentez votre activité et recevez des demandes." action={<Button asChild size="sm" variant="secondary"><Link href="/onboarding/professionnel">Créer ma fiche pro</Link></Button>} className="py-8" />
        ) : (
          <ul className="divide-y">
            {items.map((pro) => {
              const status = PRO_STATUS[pro.status] ?? { label: pro.status, tone: "neutral" as StatusTone };
              return (
                <li key={pro.id}>
                  <Link href={`/app/pro/${pro.id}`} className="flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-muted/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{pro.displayName}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {pro.city ?? "Ville non renseignée"} · fiche complète à {pro.completenessScore} %
                      </p>
                    </div>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentNotifications({ items, total, timezone }: { items: HomeDashboard["unreadNotifications"]; total: number; timezone: string }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg leading-snug font-medium">Notifications non lues</h2>
          <CardDescription>{total > items.length ? `${items.length} des ${total} plus récentes.` : `${total} en attente.`}</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/notifications">Tout voir</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((n) => (
            <li key={n.id} className="flex items-start gap-3 px-2 py-3">
              <Bell className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {n.href ? (
                  <Link href={n.href} className="font-medium hover:underline">
                    {n.title}
                  </Link>
                ) : (
                  <p className="font-medium">{n.title}</p>
                )}
                {n.body && <p className="line-clamp-2 text-sm text-muted-foreground">{n.body}</p>}
                <p className="text-xs text-muted-foreground">{formatDateFr(n.createdAt, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }, timezone)}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
