import Link from "next/link";
import { Activity, AlertTriangle, CalendarCheck, CreditCard, Flag, Inbox, Mail, ShieldAlert, Store, Users } from "lucide-react";
import { Bars } from "@/components/admin/bars";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { dateTime } from "@/components/admin/admin-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { formatEuros } from "@/lib/utils";
import { getDashboardData } from "@/modules/admin/application/dashboard";
import { STATUS_LABELS, type ProfessionalStatus } from "@/modules/professionals/domain/status";
import { requireAdminPage } from "./_lib/admin-page";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const { actor, twoFactorWarning } = await requireAdminPage("admin.dashboard", "/admin");
  const d = await getDashboardData(actor);
  const demoLabel = d.users.demo > 0 ? ` (dont ${d.users.demo} démo)` : "";
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administration" title="Tableau de bord" description="Chiffres issus de la base de données. Les séries de démonstration sont étiquetées." />
      <TwoFactorBanner show={twoFactorWarning} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Utilisateurs" value={d.users.total} hint={`${Object.entries(d.users.byRole).map(([r, n]) => `${n} ${r}`).join(" · ")}${demoLabel}`} icon={Users} />
        <StatCard label="En attente de modération" value={d.pendingModeration} hint={<Link href="/admin/moderation" className="underline">Ouvrir la file</Link>} icon={Inbox} tone={d.pendingModeration > 0 ? "warning" : "default"} />
        <StatCard label="Évènements actifs" value={d.activeEvents} hint="planification, confirmés, en cours" icon={CalendarCheck} />
        <StatCard label="Demandes commerciales (30 j)" value={d.inquiries30d} icon={Activity} />
        <StatCard label="Signalements ouverts" value={d.openReports} hint={<Link href="/admin/signalements" className="underline">Traiter</Link>} icon={Flag} tone={d.openReports > 0 ? "warning" : "default"} />
        {d.billingVisible && <StatCard label={d.mrr.isDemoOnly ? "MRR (démo)" : "MRR"} value={formatEuros(d.mrr.totalCents)} hint={d.mrr.demoCents > 0 && !d.mrr.isDemoOnly ? `dont ${formatEuros(d.mrr.demoCents)} de démo` : d.mrr.isDemoOnly ? "abonnements simulés uniquement" : "abonnements actifs × prix"} icon={CreditCard} />}
        <StatCard label="E-mails en attente" value={d.outbox.pending} hint={`${d.outbox.failed} en échec · ${d.outbox.sent} envoyés`} icon={Mail} tone={d.outbox.failed > 0 ? "warning" : "default"} />
        <StatCard label="Alertes sécurité (30 j)" value={d.securityAlerts.length} hint="sévérité ≥ moyenne" icon={ShieldAlert} tone={d.securityAlerts.length > 0 ? "warning" : "default"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Inscriptions par jour (30 j)</h2>
            {d.users.demo > 0 && <StatusBadge tone="warning">contient des comptes démo</StatusBadge>}
          </div>
          <Bars label="Inscriptions par jour" data={d.signupsPerDay.map((s) => ({ label: s.day.slice(5), value: s.count }))} />
        </Card>
        <Card className="gap-4 p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <Store className="size-4" aria-hidden="true" /> Professionnels par statut
          </h2>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(d.professionals).map(([status, n]) => (
              <li key={status} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span>{STATUS_LABELS[status as ProfessionalStatus] ?? status}</span>
                <span className="font-semibold tabular-nums">{n}</span>
              </li>
            ))}
            {Object.keys(d.professionals).length === 0 && <li className="text-muted-foreground">Aucune fiche.</li>}
          </ul>
          <h2 className="pt-2 font-semibold">Abonnements actifs par offre</h2>
          <ul className="space-y-1 text-sm">
            {d.subscriptionsByPlan.map((p) => (
              <li key={p.planKey} className="flex justify-between">
                <span>{p.planName}</span>
                <span className="tabular-nums">
                  {p.count}
                  {p.demo > 0 && <span className="text-muted-foreground"> (dont {p.demo} démo)</span>}
                </span>
              </li>
            ))}
            {d.subscriptionsByPlan.length === 0 && <li className="text-muted-foreground">Aucun abonnement actif.</li>}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-3 p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" aria-hidden="true" /> Alertes de sécurité récentes
          </h2>
          {d.securityAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune alerte de sévérité moyenne ou plus sur 30 jours.</p>
          ) : (
            <ul className="divide-y text-sm">
              {d.securityAlerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <StatusBadge tone={a.severity === "critical" || a.severity === "high" ? "danger" : "warning"}>{a.severity}</StatusBadge> <span className="ml-2 font-medium">{a.type}</span>
                  </span>
                  <span className="text-muted-foreground">{dateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/securite" className="text-sm underline">
            Journal complet
          </Link>
        </Card>
        <Card className="gap-3 p-6">
          <h2 className="font-semibold">Files de traitement</h2>
          {!d.queues ? (
            <p className="text-sm text-muted-foreground">Module worker indisponible.</p>
          ) : !d.queues.available ? (
            <p className="text-sm text-muted-foreground">Redis injoignable : statistiques indisponibles.</p>
          ) : (
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {Object.entries(d.queues.queues).map(([name, q]) => (
                <li key={name} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span>{name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {q.waiting} att. · {q.active} actifs · <span className={q.failed > 0 ? "text-destructive" : ""}>{q.failed} échecs</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Worker : {d.worker ? (d.worker.alive ? `actif (dernier signal ${d.worker.at ? dateTime(d.worker.at) : "—"})` : "aucun signal récent") : "état inconnu"}</p>
        </Card>
      </div>
    </div>
  );
}
