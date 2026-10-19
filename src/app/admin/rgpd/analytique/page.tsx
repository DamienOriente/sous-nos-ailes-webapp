import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { requireActor } from "@/lib/session";
import { canGlobal } from "@/modules/authorization";
import { getProductMetrics, lastDaysRange } from "@/modules/analytics/application/metrics";
import { PRODUCT_EVENT_LABELS, type ProductEventName } from "@/modules/analytics/domain/events";

export const metadata: Metadata = { title: "Analytique produit" };
export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  const actor = await requireActor("/admin/rgpd/analytique");
  if (!canGlobal(actor, "admin.dashboard")) redirect("/admin");
  const { jours } = await searchParams;
  const days = RANGES.find((d) => String(d) === jours) ?? 30;
  const metrics = await getProductMetrics(lastDaysRange(days));
  const names = Object.keys(PRODUCT_EVENT_LABELS) as ProductEventName[];
  const total = names.reduce((s, n) => s + metrics.counts[n], 0);

  return (
    <div className="space-y-8">
      <Link href="/admin/rgpd" className="text-sm text-muted-foreground hover:underline">Retour à RGPD et demandes</Link>
      <PageHeader
        title="Analytique produit"
        description="Compteurs internes, minimisés : évènements nommés, aucune donnée de contenu. Les visiteurs anonymes ne sont comptés qu'avec leur consentement."
      />
      <nav aria-label="Période" className="flex gap-2">
        {RANGES.map((d) => (
          <Link key={d} href={`/admin/rgpd/analytique?jours=${d}`} aria-current={days === d ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-sm ${days === d ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {d} jours
          </Link>
        ))}
      </nav>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Évènements produit" value={total} hint={`sur ${days} jours`} />
        <StatCard label="Vues d'offre premium" value={metrics.conversion.premiumViews} />
        <StatCard label="Abonnements souscrits" value={metrics.conversion.subscriptions} hint={metrics.conversion.rate === null ? "taux non calculable" : `taux ${(metrics.conversion.rate * 100).toFixed(1)} %`} tone="success" />
        <StatCard label="Résiliations" value={metrics.conversion.cancellations} tone={metrics.conversion.cancellations > 0 ? "warning" : "default"} />
      </div>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Par type d'évènement</h2>
        <ul className="mt-4 divide-y">
          {names.map((n) => {
            const v = metrics.counts[n];
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return (
              <li key={n} className="grid grid-cols-[1fr_auto] items-center gap-4 py-2 text-sm">
                <div>
                  <p className="font-medium">{PRODUCT_EVENT_LABELS[n]}</p>
                  <div className="mt-1 h-1.5 w-full max-w-md rounded-full bg-muted" aria-hidden="true">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="tabular-nums">{v}</span>
              </li>
            );
          })}
        </ul>
      </section>
      {metrics.byDay.length > 0 && (
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Par jour</h2>
          <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-3 lg:grid-cols-5">
            {metrics.byDay.map((d) => (
              <li key={d.day} className="flex justify-between rounded-md bg-muted/50 px-3 py-1.5">
                <span>{d.day}</span>
                <span className="tabular-nums">{d.total}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
