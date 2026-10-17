import type { Metadata } from "next";
import { Eye, Inbox, Reply, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { TrendScene } from "@/components/illustrations/pro-scenes";
import { WeeklyChart } from "@/components/pages/workspace/weekly-chart";
import { requireActor } from "@/lib/session";
import { getManagedListing } from "@/modules/professionals/application/professional-service";
import { getListingStats, getListingTimeline } from "@/modules/professionals/application/stats-service";
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUSES } from "@/modules/inquiries/domain/inquiry-status";

export const metadata: Metadata = { title: "Statistiques" };

export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/pro/${id}/statistiques`);
  const [stats, timeline, managed] = await Promise.all([getListingStats(actor, id), getListingTimeline(actor, id, 12), getManagedListing(actor, id)]);
  const max = Math.max(1, ...Object.values(stats.inquiriesByStatus));
  const hasActivity = stats.inquiriesTotal > 0 || stats.pageViews > 0;
  return (
    <div className="space-y-6">
      <PageHeader title="Statistiques" description="L'essentiel pour piloter votre activité, calculé à partir des demandes et des vues réelles de votre page. Les statistiques détaillées (sources, conversion, comparaison) font partie de l'offre Premium." />
      {managed.listing.isDemo && (
        <p className="rounded-xl border border-warning/40 bg-warning/15 px-4 py-2 text-sm" role="note">
          Fiche de démonstration : les demandes et les avis ci-dessous sont fictifs, générés par le jeu de données de démo.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vues de la page publique" value={stats.pageViews} icon={Eye} hint="Depuis la publication" />
        <StatCard label="Demandes reçues" value={stats.inquiriesTotal} icon={Inbox} hint={`${stats.last30DaysInquiries} sur 30 jours`} />
        <StatCard label="Taux de réponse" value={stats.responseRate === null ? "—" : `${stats.responseRate} %`} icon={Reply} hint="Demandes ayant reçu une action" tone={stats.responseRate !== null && stats.responseRate < 50 ? "warning" : "default"} />
        <StatCard label="Conversion" value={stats.inquiriesTotal ? `${Math.round((((stats.inquiriesByStatus.confirmed ?? 0) + (stats.inquiriesByStatus.accepted ?? 0)) / stats.inquiriesTotal) * 100)} %` : "—"} icon={TrendingUp} hint="Demandes acceptées ou confirmées" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Demandes par semaine</CardTitle>
            <CardDescription>Les douze dernières semaines, d'après la date de réception de chaque demande.</CardDescription>
          </CardHeader>
          <CardContent>
            {hasActivity ? (
              <WeeklyChart weeks={timeline.weeks} />
            ) : (
              <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
                <TrendScene className="mx-auto w-40" />
                <p className="text-sm text-muted-foreground text-pretty">La courbe se dessine dès les premières demandes. Une page publiée avec photos, prestations chiffrées et disponibilités en reçoit plus vite.</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Délai de réponse</CardTitle>
            <CardDescription>Temps médian avant votre première action sur une demande.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-heading text-4xl font-semibold tabular-nums">{timeline.medianResponseHours === null ? "—" : timeline.medianResponseHours < 1 ? "< 1 h" : timeline.medianResponseHours < 48 ? `${Math.round(timeline.medianResponseHours)} h` : `${Math.round(timeline.medianResponseHours / 24)} j`}</p>
            <p className="text-sm text-muted-foreground text-pretty">{timeline.medianResponseHours === null ? "Mesuré dès votre première réponse." : timeline.medianResponseHours <= 24 ? "Sous 24 h : c'est ce qui compte le plus dans le classement de l'annuaire." : "Au-delà de 24 h, une première réponse rapide, même pour demander des précisions, améliore votre classement."}</p>
            <p className="text-xs text-muted-foreground">Vues de la page : compteur cumulé depuis la publication ({stats.pageViews}) ; l'historique des vues n'est pas conservé.</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Demandes par statut</CardTitle>
          <CardDescription>Répartition de toutes les demandes reçues.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {INQUIRY_STATUSES.map((s) => {
              const n = stats.inquiriesByStatus[s] ?? 0;
              return (
                <li key={s} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{INQUIRY_STATUS_LABELS[s]}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
                  </div>
                  <span className="text-right font-medium tabular-nums">{n}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
