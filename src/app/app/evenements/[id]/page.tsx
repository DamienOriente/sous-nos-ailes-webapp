import Link from "next/link";
import { AlertTriangle, ArrowRight, Baby, CheckSquare, Euro, Handshake, Info, Mail, MessageSquare, Search, ShieldAlert, Sparkles } from "lucide-react";
import { EmptyState, StatCard, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActor } from "@/lib/session";
import { formatDateFr, formatEuros } from "@/lib/utils";
import { getEventDashboard } from "@/modules/events/application/dashboard-service";
import { suggestProfessionals } from "@/modules/events/application/event-service";
import { countdownLabel } from "@/modules/events/domain/event-status";
import { PROVIDER_STATUS_LABELS, PROVIDER_STATUS_TONES } from "@/modules/events/domain/providers";
import { guardPage } from "./_guards";

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
    <div className="space-y-8">
      {nouveau === "1" && (
        <Card className="border-primary/30 bg-accent/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" aria-hidden="true" />
              Votre espace est prêt
            </CardTitle>
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
                <Link href={`/annuaire/${m.slug}?department=${encodeURIComponent(event.department ?? "")}&event=${id}`}>
                  <Search className="size-3.5" aria-hidden="true" />
                  Trouver : {m.name}
                </Link>
              </Button>
            ))}
          </div>
          {suggestions.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((p) => (
                <li key={p.id} className="rounded-xl border bg-card p-4">
                  <p className="text-xs font-semibold tracking-wide text-primary uppercase">{p.categoryName}</p>
                  <p className="mt-1 font-medium">{p.displayName}</p>
                  {p.tagline && <p className="line-clamp-2 text-sm text-muted-foreground">{p.tagline}</p>}
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{p.city ?? "—"}</span>
                    <Link href={`/pro/${p.slug}?event=${id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                      Voir la fiche <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-label="Indicateurs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Compte à rebours" value={d.daysUntil === null ? "—" : countdownLabel(d.daysUntil).split(" · ")[0]} hint={event.eventDate ? formatDateFr(event.eventDate, undefined, event.timezone) : "Fixez une date dans les paramètres"} />
        {access.permissions.has("event.providers.view") && (
          <StatCard label="Prestataires" value={`${d.providers.confirmed} / ${d.providers.total}`} hint={`${d.providers.confirmed} confirmés · ${d.providers.pending} en attente`} icon={Handshake} tone={d.providers.pending > 0 ? "warning" : "success"} />
        )}
        {access.permissions.has("event.tasks.view") && (
          <StatCard label="Tâches restantes" value={d.tasks.open} hint={d.tasks.overdue > 0 ? `${d.tasks.overdue} en retard` : `${d.tasks.done} terminées`} icon={CheckSquare} tone={d.tasks.overdue > 0 ? "warning" : "default"} />
        )}
        {d.budget && (
          <StatCard
            label="Budget"
            value={formatEuros(d.budget.committedCents)}
            hint={`Prévu ${formatEuros(d.budget.plannedCents)} · payé ${formatEuros(d.budget.paidCents)}`}
            icon={Euro}
            tone={d.budget.plannedCents > 0 && d.budget.committedCents > d.budget.plannedCents ? "warning" : "default"}
          />
        )}
        {d.invitations && <StatCard label="Invitations" value={`${d.invitations.answered} / ${d.invitations.sent}`} hint="réponses reçues / envoyées" icon={Mail} />}
        {d.childrenCount !== null && <StatCard label="Enfants inscrits" value={d.childrenCount} hint={event.expectedChildren ? `${event.expectedChildren} attendus` : undefined} icon={Baby} />}
        <StatCard label="Messages non lus" value={d.unreadMessages} icon={MessageSquare} tone={d.unreadMessages > 0 ? "warning" : "default"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {d.alerts.length > 0 && (
            <section aria-labelledby="alerts" className="space-y-2">
              <h2 id="alerts" className="text-lg font-semibold">
                Alertes
              </h2>
              <ul className="space-y-2">
                {d.alerts.map((a) => (
                  <li key={a.key}>
                    <Link href={a.href ?? base} className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted/50">
                      {a.severity === "danger" ? <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" /> : a.severity === "warning" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden="true" /> : <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />}
                      <span>
                        <span className="block font-medium">{a.title}</span>
                        {a.description && <span className="block text-sm text-muted-foreground">{a.description}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {access.permissions.has("event.tasks.view") && (
            <section aria-labelledby="deadlines" className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 id="deadlines" className="text-lg font-semibold">
                  Prochaines échéances
                </h2>
                <Link href={`${base}/taches`} className="text-sm font-medium text-primary hover:underline">
                  Toutes les tâches
                </Link>
              </div>
              {d.upcomingTasks.length === 0 ? (
                <EmptyState title="Aucune échéance à venir" description="Ajoutez des tâches avec une date pour les voir apparaître ici." />
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
            <section aria-labelledby="validations" className="space-y-2">
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

        <aside className="space-y-2" aria-labelledby="recent-messages">
          <div className="flex items-center justify-between">
            <h2 id="recent-messages" className="text-lg font-semibold">
              Derniers messages
            </h2>
            <Link href={`${base}/messages`} className="text-sm font-medium text-primary hover:underline">
              Messagerie
            </Link>
          </div>
          {d.recentMessages.length === 0 ? (
            <EmptyState icon={MessageSquare} title="Pas encore de message" description="Le canal Général est ouvert à toute l'équipe." />
          ) : (
            <ul className="space-y-2">
              {d.recentMessages.map((m) => (
                <li key={m.id}>
                  <Link href={`${base}/messages/${m.channelId}`} className="block rounded-xl border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/50">
                    <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">
                        <span className="font-medium text-foreground">{m.authorName}</span> · #{m.channelName}
                      </span>
                      <time dateTime={m.createdAt.toISOString()}>{formatDateFr(m.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                    </span>
                    <span className="mt-1 line-clamp-2 block">{m.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <CardContent className="px-0 pt-2 text-xs text-muted-foreground">Les organisateurs de l'évènement peuvent lire tous les échanges de cet espace.</CardContent>
        </aside>
      </div>
    </div>
  );
}
