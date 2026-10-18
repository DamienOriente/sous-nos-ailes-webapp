import Link from "next/link";
import { Monogram, ProgressBar } from "@/components/events/event-cover";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { CalendarScene, KidsCornerScene } from "@/components/illustrations";
import { ChatScene, HandshakeScene } from "@/components/illustrations/event-scenes";
import { StatCard, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActor } from "@/lib/session";
import { formatDateFr, formatEuros } from "@/lib/utils";
import { getEventDashboard } from "@/modules/events/application/dashboard-service";
import { suggestProfessionals } from "@/modules/events/application/event-service";
import { countdownLabel } from "@/modules/events/domain/event-status";
import { PROVIDER_STATUS_LABELS, PROVIDER_STATUS_TONES } from "@/modules/events/domain/providers";
import { publicImageHref } from "@/modules/files/application/file-urls";
import { guardPage } from "./_guards";

const ALERT_LABELS = { danger: "Urgent", warning: "À surveiller", info: "Pour information" } as const;
const ALERT_TEXT = { danger: "text-destructive", warning: "text-warning-foreground", info: "text-muted-foreground" } as const;

function timeIn(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(d);
}

export default async function EventDashboardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nouveau?: string }> }) {
  const { id } = await params;
  const { nouveau } = await searchParams;
  const actor = await requireActor(`/app/evenements/${id}`);
  const d = await guardPage(() => getEventDashboard(actor, id));
  const { event, access } = { event: d.event, access: d.event.access };
  const base = `/app/evenements/${id}`;
  const missing = d.wanted.filter((w) => !w.filled);
  const showSuggestions = access.permissions.has("event.providers.manage") && (nouveau === "1" || missing.length > 0);
  const suggestions = showSuggestions ? await suggestProfessionals(missing.map((m) => m.slug), event.department) : [];

  return (
    <div className="space-y-6">
      {nouveau === "1" && (
        <Card className="bg-accent/40">
          <CardHeader>
            <CardTitle>Votre espace est prêt</CardTitle>
            <CardDescription>
              Nous avons préparé une liste de tâches adaptée à votre évènement, un canal de discussion pour l'équipe et un budget par poste. Commencez par trouver vos premiers professionnels.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {showSuggestions && missing.length > 0 && (
        <section aria-labelledby="first-pros" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="first-pros" className="text-lg font-semibold">
                Premiers professionnels pour vous
              </h2>
              <p className="text-sm text-muted-foreground">Catégories recherchées sans prestataire : {missing.map((m) => m.name).join(", ")}.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {missing.map((m) => (
              <Button key={m.slug} asChild variant="outline" size="sm">
                <Link href={`/annuaire/${m.slug}?department=${encodeURIComponent(event.department ?? "")}&event=${id}`}>Trouver : {m.name}</Link>
              </Button>
            ))}
          </div>
          {suggestions.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((p) => (
                <li key={p.id} className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{p.categoryName}</p>
                  <p className="mt-1 font-medium">{p.displayName}</p>
                  {p.tagline && <p className="line-clamp-2 text-sm text-muted-foreground">{p.tagline}</p>}
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{p.city ?? "Ville non renseignée"}</span>
                    <Link href={`/pro/${p.slug}?event=${id}`} className="font-medium text-primary hover:underline">
                      Voir la fiche
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-label="Indicateurs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Compte à rebours" value={d.daysUntil === null ? "n/d" : countdownLabel(d.daysUntil).split(" · ")[0]} hint={event.eventDate ? formatDateFr(event.eventDate, undefined, event.timezone) : "Fixez une date dans les paramètres"} />
        {access.permissions.has("event.providers.view") && (
          <StatCard label="Prestataires" value={`${d.providers.confirmed} / ${d.providers.total}`} hint={`${d.providers.confirmed} confirmés · ${d.providers.pending} en attente`} />
        )}
        {access.permissions.has("event.tasks.view") && (
          <StatCard label="Tâches restantes" value={d.tasks.open} hint={d.tasks.overdue > 0 ? `${d.tasks.overdue} en retard` : `${d.tasks.done} terminées`} />
        )}
        {d.budget && (
          <StatCard
            label="Budget"
            value={formatEuros(d.budget.committedCents)}
            hint={`Prévu ${formatEuros(d.budget.plannedCents)} · payé ${formatEuros(d.budget.paidCents)}`}
          />
        )}
        {d.invitations && <StatCard label="Invitations" value={`${d.invitations.answered} / ${d.invitations.sent}`} hint="réponses reçues / envoyées" />}
        {d.childrenCount !== null && <StatCard label="Enfants inscrits" value={d.childrenCount} hint={event.expectedChildren ? `${event.expectedChildren} attendus` : undefined} />}
        <StatCard label="Messages non lus" value={d.unreadMessages} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {access.permissions.has("event.milestones.view") && (
            <section aria-labelledby="moments" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 id="moments" className="text-lg font-semibold">
                  Moments à venir
                </h2>
                <Link href={`${base}/planning`} className="text-sm font-medium text-primary hover:underline">
                  Planning complet
                </Link>
              </div>
              {d.upcomingMilestones.length === 0 ? (
                <IllustratedEmpty
                  scene={CalendarScene}
                  compact
                  title="Le déroulé du jour J n'est pas encore écrit"
                  description="Les moments clés sont partagés avec les prestataires concernés, qui sont prévenus à chaque changement."
                  example="Cérémonie, de 15:00 à 16:00, dans le parc"
                  action={access.permissions.has("event.milestones.manage") ? <Button asChild size="sm"><Link href={`${base}/planning`}>Construire le planning</Link></Button> : undefined}
                />
              ) : (
                <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="dashboard-moments">
                  {d.upcomingMilestones.map((m) => (
                    <li key={m.id} className="rounded-2xl border bg-card p-4">
                      <p className="font-heading text-lg font-semibold tabular-nums">
                        {timeIn(m.startsAt, event.timezone)}
                        {m.endsAt ? ` à ${timeIn(m.endsAt, event.timezone)}` : ""}
                      </p>
                      <p className="mt-1 font-medium leading-snug">{m.title}</p>
                      {m.location && <p className="mt-1 text-sm text-muted-foreground">{m.location}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          {access.isOrganizer && d.sectionProgress.length > 0 && (
            <section aria-labelledby="progress" className="space-y-3 rounded-2xl border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 id="progress" className="text-lg font-semibold">
                  Progression par section
                </h2>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {d.tasks.done} / {d.tasks.total} tâches
                </span>
              </div>
              <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2" data-testid="dashboard-sections">
                {d.sectionProgress.map((s) => (
                  <li key={s.section} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <Link href={`${base}/taches`} className="font-medium hover:underline">
                        {s.section}
                      </Link>
                      <span className="text-muted-foreground tabular-nums">
                        {s.done}/{s.total}
                      </span>
                    </div>
                    <ProgressBar value={s.done} max={s.total} label={`${s.section} : ${s.done} sur ${s.total}`} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {access.isOrganizer && (
            <section aria-labelledby="attention" className="space-y-3">
              <h2 id="attention" className="text-lg font-semibold">
                Points d'attention
              </h2>
              {d.alerts.length === 0 ? (
                <p className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">Rien à signaler : aucune tâche en retard, aucun budget dépassé, tous les prestataires recherchés sont trouvés.</p>
              ) : (
                <ul className="space-y-2">
                  {d.alerts.map((a) => (
                    <li key={a.key}>
                      <Link href={a.href ?? base} className="block rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted/50">
                        <span>
                          <span className={`block text-xs font-medium ${ALERT_TEXT[a.severity]}`}>{ALERT_LABELS[a.severity]}</span>
                          <span className="block font-medium">{a.title}</span>
                          {a.description && <span className="block text-sm text-muted-foreground">{a.description}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {access.permissions.has("event.providers.view") && (
            <section aria-labelledby="confirmed" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 id="confirmed" className="text-lg font-semibold">
                  Prestataires confirmés
                </h2>
                <Link href={`${base}/prestataires`} className="text-sm font-medium text-primary hover:underline">
                  Tous les prestataires
                </Link>
              </div>
              {d.confirmedProviders.length === 0 ? (
                <IllustratedEmpty scene={HandshakeScene} compact title="Aucun prestataire confirmé pour l'instant" description="Dès qu'un devis est accepté, le professionnel apparaît ici avec la photo de sa fiche." example="Domaine des Tilleuls, lieu de réception, confirmé" action={access.permissions.has("event.providers.manage") ? <Button asChild size="sm" variant="outline"><Link href={`${base}/prestataires`}>Voir la présélection</Link></Button> : undefined} />
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="dashboard-providers">
                  {d.confirmedProviders.map((p) => (
                    <li key={p.id}>
                      <Link href={`${base}/prestataires/${p.id}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-colors hover:bg-muted/40">
                        <div className="relative aspect-[5/2] bg-muted">
                          {p.coverFileId ? (
                            // eslint-disable-next-line @next/next/no-img-element -- public rendition served by the files module
                            <img src={publicImageHref(p.coverFileId, "medium")} alt="" className="absolute inset-0 size-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-sage-soft">
                              <Monogram name={p.displayName} size="lg" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-xs text-muted-foreground">{p.categoryName ?? "Prestataire"}</p>
                          <p className="truncate font-medium group-hover:underline">{p.displayName}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {access.permissions.has("event.tasks.view") && (
            <section aria-labelledby="deadlines" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 id="deadlines" className="text-lg font-semibold">
                  Prochaines échéances
                </h2>
                <Link href={`${base}/taches`} className="text-sm font-medium text-primary hover:underline">
                  Toutes les tâches
                </Link>
              </div>
              {d.upcomingTasks.length === 0 ? (
                <p className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">Aucune échéance à venir. Ajoutez une date aux tâches pour les voir apparaître ici.</p>
              ) : (
                <ul className="divide-y rounded-xl border bg-card">
                  {d.upcomingTasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{t.title}</span>
                        {t.section && <span className="text-xs text-muted-foreground">{t.section}</span>}
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">{t.dueDate ? formatDateFr(t.dueDate, { day: "numeric", month: "short" }) : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {d.pendingValidations.length > 0 && (
            <section aria-labelledby="validations" className="space-y-3">
              <h2 id="validations" className="text-lg font-semibold">
                Validations en attente
              </h2>
              <ul className="divide-y rounded-xl border bg-card">
                {d.pendingValidations.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <Link href={`${base}/prestataires/${p.id}`} className="min-w-0 truncate font-medium hover:underline">
                      {p.label}
                      {p.categoryName && <span className="ml-2 text-xs font-normal text-muted-foreground">{p.categoryName}</span>}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2">
                      {p.quoteCents !== null && <span className="tabular-nums">{formatEuros(p.quoteCents)}</span>}
                      <StatusBadge tone={PROVIDER_STATUS_TONES[p.status as keyof typeof PROVIDER_STATUS_TONES]}>{PROVIDER_STATUS_LABELS[p.status as keyof typeof PROVIDER_STATUS_LABELS]}</StatusBadge>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {d.childcareTeam && (
            <section aria-labelledby="kids-team" className="overflow-hidden rounded-2xl border bg-card" data-testid="dashboard-kids">
              <div className="bg-sage-soft/60 px-5 pt-4">
                <KidsCornerScene className="mx-auto max-w-[14rem]" />
              </div>
              <div className="space-y-3 p-6">
                <div className="flex items-center justify-between">
                  <h2 id="kids-team" className="text-lg font-semibold">
                    Équipe enfants
                  </h2>
                  <Link href={`${base}/enfants`} className="text-sm font-medium text-primary hover:underline">
                    Espace enfants
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">{d.childcareTeam.children}</span> enfant{d.childcareTeam.children > 1 ? "s" : ""} inscrit{d.childcareTeam.children > 1 ? "s" : ""}
                  {d.childcareTeam.expected ? ` sur ${d.childcareTeam.expected} attendus` : ""} · {d.childcareTeam.members.length} encadrant{d.childcareTeam.members.length > 1 ? "s" : ""}
                </p>
                {d.childcareTeam.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun professionnel de la garde d'enfants n'a encore rejoint l'équipe.</p>
                ) : (
                  <ul className="space-y-2">
                    {d.childcareTeam.members.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 text-sm">
                        <Monogram name={m.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{m.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{m.title ?? (m.role === "staff" ? "Renfort" : "Responsable")}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {m.assigned} enfant{m.assigned > 1 ? "s" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          <section className="space-y-3" aria-labelledby="recent-messages">
            <div className="flex items-center justify-between">
              <h2 id="recent-messages" className="text-lg font-semibold">
                Derniers messages
              </h2>
              <Link href={`${base}/messages`} className="text-sm font-medium text-primary hover:underline">
                Messagerie
              </Link>
            </div>
            {d.recentMessages.length === 0 ? (
              <IllustratedEmpty scene={ChatScene} compact title="Pas encore de message" description="Le canal Général est ouvert à toute l'équipe ; les organisateurs lisent tous les échanges." example="Bienvenue à tous ! Le planning du jour J est dans l'onglet Planning." action={<Button asChild size="sm" variant="outline"><Link href={`${base}/messages`}>Écrire le premier message</Link></Button>} />
            ) : (
              <ul className="space-y-2" data-testid="dashboard-messages">
                {d.recentMessages.map((m) => (
                  <li key={m.id}>
                    <Link href={`${base}/messages/${m.channelId}`} className="flex gap-3 rounded-xl border bg-card px-3 py-3 text-sm transition-colors hover:bg-muted/50">
                      <Monogram name={m.authorName} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate">
                            <span className="font-medium text-foreground">{m.authorName}</span> · #{m.channelName}
                          </span>
                          <time dateTime={m.createdAt.toISOString()} className="shrink-0">
                            {formatDateFr(m.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </time>
                        </span>
                        <span className="mt-1 line-clamp-2 block">{m.body}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <CardContent className="px-0 pt-2 text-xs text-muted-foreground">Les organisateurs de l'évènement peuvent lire tous les échanges de cet espace.</CardContent>
          </section>
        </aside>
      </div>
    </div>
  );
}
