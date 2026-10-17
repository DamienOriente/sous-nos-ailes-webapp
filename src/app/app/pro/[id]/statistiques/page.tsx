import type { Metadata } from "next";
import { Eye, Inbox, Reply, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { requireActor } from "@/lib/session";
import { getListingStats } from "@/modules/professionals/application/stats-service";
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUSES } from "@/modules/inquiries/domain/inquiry-status";

export const metadata: Metadata = { title: "Statistiques" };

export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/pro/${id}/statistiques`);
  const stats = await getListingStats(actor, id);
  const max = Math.max(1, ...Object.values(stats.inquiriesByStatus));
  return (
    <div className="space-y-6">
      <PageHeader title="Statistiques" description="L'essentiel pour piloter votre activité. Les statistiques détaillées (sources, conversion, comparaison) font partie de l'offre Premium." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vues de la page publique" value={stats.pageViews} icon={Eye} hint="Depuis la publication" />
        <StatCard label="Demandes reçues" value={stats.inquiriesTotal} icon={Inbox} hint={`${stats.last30DaysInquiries} sur 30 jours`} />
        <StatCard label="Taux de réponse" value={stats.responseRate === null ? "—" : `${stats.responseRate} %`} icon={Reply} hint="Demandes ayant reçu une action" tone={stats.responseRate !== null && stats.responseRate < 50 ? "warning" : "default"} />
        <StatCard label="Conversion" value={stats.inquiriesTotal ? `${Math.round((((stats.inquiriesByStatus.confirmed ?? 0) + (stats.inquiriesByStatus.accepted ?? 0)) / stats.inquiriesTotal) * 100)} %` : "—"} icon={TrendingUp} hint="Demandes acceptées ou confirmées" />
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
