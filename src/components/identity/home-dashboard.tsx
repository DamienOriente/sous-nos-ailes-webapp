import Link from "next/link";
import { ArrowRight, Baby, Bell, CalendarDays, ChevronRight, MapPin, Plus, Search, Store, Users } from "lucide-react";
import { KidsCornerScene, WingsScene } from "@/components/illustrations";
import { StorefrontScene } from "@/components/illustrations/app-scenes";
import { ORGANIZER_EXAMPLE_SUMMARY, PROFESSIONAL_EXAMPLE_SUMMARY } from "@/components/professionals/listing-examples";
import { DemoPhoto } from "@/components/shared/demo-photo";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn, formatDateFr } from "@/lib/utils";
import { EVENT_ROLE_LABELS, type EventRole } from "@/modules/authorization";
import { EVENT_TYPE_LABELS, type EventType } from "@/modules/events/domain/event-types";
import { privateFileHref, publicImageHref } from "@/modules/files/application/file-urls";
import type { HomeDashboard } from "@/modules/identity/application/home-dashboard";
import { categoryPhoto, eventPhoto } from "@/modules/media/demo-photos";

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

/** Illustrated welcome band: the greeting is the page title (PageHeader); this adds the scene and the day's summary. */
export function WelcomeBanner({ dashboard }: { dashboard: HomeDashboard }) {
  const nextEvent = dashboard.upcomingEvents.find((e) => e.eventDate);
  const days = dashboard.nextEventInDays;
  const summary = dashboard.isEmpty
    ? "Votre espace est prêt. Choisissez un parcours ci-dessous, ou reprenez l'un des deux exemples pour voir l'application remplie."
    : nextEvent && days !== null
      ? `${nextEvent.name} dans ${days} jour${days > 1 ? "s" : ""}${nextEvent.expectedChildren ? `, ${nextEvent.expectedChildren} enfants annoncés` : ""}.`
      : dashboard.professionals.length > 0
        ? `${dashboard.professionals.length} fiche${dashboard.professionals.length > 1 ? "s" : ""} professionnelle${dashboard.professionals.length > 1 ? "s" : ""}, ${dashboard.unreadCount} notification${dashboard.unreadCount > 1 ? "s" : ""} non lue${dashboard.unreadCount > 1 ? "s" : ""}.`
        : "Voici l'essentiel de votre activité.";
  return (
    <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-accent/70 via-card to-sand/40 p-6 sm:p-8" aria-label="Résumé">
      <div className="relative z-10 max-w-xl space-y-2">
        <p className="text-sm text-muted-foreground text-pretty">{summary}</p>
        {!dashboard.isEmpty && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm" variant="outline">
              <Link href="/app/evenements/nouveau">
                <Plus aria-hidden="true" /> Nouvel évènement
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/annuaire">
                <Search aria-hidden="true" /> Trouver un professionnel
              </Link>
            </Button>
          </div>
        )}
      </div>
      <WingsScene className="pointer-events-none absolute -bottom-6 -right-4 w-56 opacity-90 sm:w-72" />
    </section>
  );
}

export function NextActions({ actions }: { actions: HomeDashboard["nextActions"] }) {
  if (actions.length === 0) return null;
  return (
    <section aria-labelledby="prochaines-actions" className="space-y-3">
      <h2 id="prochaines-actions" className="font-heading text-lg font-medium">
        Prochaines actions
      </h2>
      <ol className="grid gap-3 sm:grid-cols-2" data-testid="next-actions">
        {actions.map((a, i) => (
          <li key={a.key}>
            <Link href={a.href} className={cn("group flex h-full items-start gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/50", a.tone === "warning" && "border-warning/50 bg-warning/10 hover:bg-warning/15")}>
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums", a.tone === "warning" ? "bg-warning/30 text-warning-foreground" : "bg-primary/10 text-primary")}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{a.title}</span>
                <span className="block text-sm text-muted-foreground text-pretty">{a.detail}</span>
              </span>
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

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

/** Empty space: the two journeys, each with a photo, a scene and a worked example. */
export function WelcomeState() {
  const journeys = [
    { href: "/onboarding/organisateur", title: "Vous préparez un évènement ?", description: "Créez votre espace, invitez vos coorganisateurs et trouvez les bons professionnels, garde d'enfants comprise.", cta: "Créer mon évènement", example: ORGANIZER_EXAMPLE_SUMMARY, photo: eventPhoto("wedding", 3), Scene: KidsCornerScene, variant: "default" as const, testId: "journey-organizer" },
    { href: "/onboarding/professionnel", title: "Vous proposez vos services ?", description: "Publiez votre fiche dans l'annuaire, recevez des demandes de contact et de devis, gérez vos interventions.", cta: "Créer ma fiche pro", example: PROFESSIONAL_EXAMPLE_SUMMARY, photo: categoryPhoto("garde-enfants-evenementielle", 1), Scene: StorefrontScene, variant: "secondary" as const, testId: "journey-professional" },
  ];
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {journeys.map((j) => (
        <article key={j.href} className="flex flex-col overflow-hidden rounded-3xl border bg-card shadow-soft" data-testid={j.testId}>
          <div className="relative aspect-[16/8]">
            <DemoPhoto photo={j.photo} width={800} height={400} sizes="(max-width: 768px) 100vw, 50vw" className="absolute inset-0" alt={`Photo d'ambiance de démonstration : ${j.title.toLowerCase()}`} />
            <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" aria-hidden="true" />
            <j.Scene className="absolute bottom-0 right-3 w-36 sm:w-44" />
          </div>
          <div className="flex flex-1 flex-col gap-4 p-5">
            <div className="space-y-1.5">
              <h2 className="font-heading text-xl leading-snug font-medium">{j.title}</h2>
              <p className="text-sm text-muted-foreground text-pretty">{j.description}</p>
            </div>
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground text-pretty">{j.example}</p>
            <Button asChild variant={j.variant} className="mt-auto w-fit">
              <Link href={j.href}>
                {j.cta} <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function UpcomingEvents({ events, timezone }: { events: HomeDashboard["upcomingEvents"]; timezone: string }) {
  return (
    <section aria-labelledby="mes-evenements" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="mes-evenements" className="font-heading text-lg leading-snug font-medium">
            Mes prochains évènements
          </h2>
          <p className="text-sm text-muted-foreground">Ceux où vous êtes membre actif.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/evenements">Tout voir</Link>
        </Button>
      </div>
      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Aucun évènement à venir" description="Créez votre premier évènement ou acceptez une invitation." action={<Button asChild size="sm"><Link href="/app/evenements/nouveau">Créer un évènement</Link></Button>} className="py-8" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events.map((ev, i) => {
            const status = EVENT_STATUS[ev.status] ?? { label: ev.status, tone: "neutral" as StatusTone };
            const photo = eventPhoto(ev.type, i);
            return (
              <li key={ev.id}>
                <Link href={`/app/evenements/${ev.id}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-soft" data-testid="home-event-card">
                  <div className="relative aspect-[16/7]">
                    <DemoPhoto photo={photo} width={640} height={280} sizes="(max-width: 640px) 100vw, 400px" className="absolute inset-0" alt={`Photo d'ambiance de démonstration : ${(EVENT_TYPE_LABELS[ev.type as EventType] ?? ev.type).toLowerCase()}`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" aria-hidden="true" />
                    <div className="absolute left-3 top-3 flex size-12 flex-col items-center justify-center rounded-xl bg-card/95 text-foreground shadow-soft">
                      {ev.eventDate ? (
                        <>
                          <span className="text-base font-semibold leading-none tabular-nums">{formatDateFr(ev.eventDate, { day: "numeric" }, timezone)}</span>
                          <span className="text-[11px] uppercase">{formatDateFr(ev.eventDate, { month: "short" }, timezone).replace(".", "")}</span>
                        </>
                      ) : (
                        <CalendarDays className="size-5" aria-hidden="true" />
                      )}
                    </div>
                    <StatusBadge tone={status.tone} className="absolute right-3 top-3 bg-card/95">
                      {status.label}
                    </StatusBadge>
                  </div>
                  <div className="space-y-2 p-4">
                    <p className="truncate font-heading text-lg leading-snug font-medium">{ev.name}</p>
                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{EVENT_ROLE_LABELS[ev.role as EventRole] ?? ev.role}</span>
                      {(ev.venueName || ev.city) && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden="true" />
                          {[ev.venueName, ev.city].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {ev.expectedGuests ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" aria-hidden="true" />
                          {ev.expectedGuests} invités
                        </span>
                      ) : null}
                      {ev.expectedChildren ? (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <Baby className="size-3" aria-hidden="true" />
                          {ev.expectedChildren} enfants
                        </span>
                      ) : null}
                      {ev.eventDate && ev.dateIsTentative && <span>date à confirmer</span>}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function MyProfessionals({ items }: { items: HomeDashboard["professionals"] }) {
  return (
    <section aria-labelledby="mes-fiches" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="mes-fiches" className="font-heading text-lg leading-snug font-medium">
            Mes fiches pro
          </h2>
          <p className="text-sm text-muted-foreground">Vos activités présentes dans l'annuaire.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/pro">Tout voir</Link>
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Store} title="Aucune fiche professionnelle" description="Présentez votre activité et recevez des demandes." action={<Button asChild size="sm" variant="secondary"><Link href="/onboarding/professionnel">Créer ma fiche pro</Link></Button>} className="py-8" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((pro, i) => {
            const status = PRO_STATUS[pro.status] ?? { label: pro.status, tone: "neutral" as StatusTone };
            const fallback = categoryPhoto(pro.categorySlug ?? "reception", i);
            const coverSrc = pro.coverFileId ? (pro.status === "published" ? publicImageHref(pro.coverFileId, "medium") : privateFileHref(pro.coverFileId)) : null;
            return (
              <li key={pro.id}>
                <Link href={`/app/pro/${pro.id}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-soft" data-testid="home-pro-card">
                  <div className="relative aspect-[16/7]">
                    {coverSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element -- served through the authenticated file route (signed redirect), dimensions unknown
                      <img src={coverSrc} alt="" className="absolute inset-0 size-full object-cover" style={{ backgroundColor: fallback.tone }} />
                    ) : (
                      <DemoPhoto photo={fallback} width={640} height={280} sizes="(max-width: 640px) 100vw, 400px" className="absolute inset-0" alt="Photo d'ambiance de démonstration en attendant votre photo de couverture" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" aria-hidden="true" />
                    <StatusBadge tone={status.tone} className="absolute right-3 top-3 bg-card/95">
                      {status.label}
                    </StatusBadge>
                    {!coverSrc && <span className="absolute bottom-2 left-3 rounded-full bg-card/90 px-2 py-0.5 text-[10px] text-muted-foreground">Photo de démonstration · ajoutez votre couverture</span>}
                  </div>
                  <div className="space-y-2 p-4">
                    <p className="truncate font-heading text-lg leading-snug font-medium">{pro.displayName.trim() || "Fiche en cours de création"}</p>
                    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {pro.categoryName && <span>{pro.categoryName}</span>}
                      <span>{pro.city ?? "Ville non renseignée"}</span>
                      <span className="tabular-nums">fiche complète à {pro.completenessScore} %</span>
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pro.completenessScore}%` }} />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function RecentNotifications({ items, total, timezone }: { items: HomeDashboard["unreadNotifications"]; total: number; timezone: string }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg leading-snug font-medium">Notifications non lues</h2>
            <CardDescription>{total > items.length ? `${items.length} des ${total} plus récentes.` : `${total} en attente.`}</CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/notifications">Tout voir</Link>
          </Button>
        </div>
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
