import { AdminTable, dateTime } from "@/components/admin/admin-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatEuros } from "@/lib/utils";
import { SUBSCRIPTION_STATUS_LABELS, type SubscriptionStatus } from "@/modules/billing/domain/subscription-status";
import { computeMrr, listSubscriptionsAdmin } from "@/modules/billing/application/billing-admin";
import { requireAdminPage } from "../../_lib/admin-page";
import { OffersSubnav } from "../page";

export const dynamic = "force-dynamic";

export default async function SubscriptionsAdminPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { actor } = await requireAdminPage("admin.billing.view", "/admin/offres/abonnements");
  const sp = await searchParams;
  const [rows, mrr] = await Promise.all([listSubscriptionsAdmin(actor, { status: sp.statut || undefined }), computeMrr()]);
  return (
    <div className="space-y-6">
      <PageHeader title="Abonnements" description={`MRR ${mrr.isDemoOnly ? "(démo) " : ""}${formatEuros(mrr.totalCents)}${mrr.demoCents > 0 && !mrr.isDemoOnly ? ` dont ${formatEuros(mrr.demoCents)} de démo` : ""} · ${rows.length} abonnement(s) listé(s).`} />
      <OffersSubnav current="/admin/offres/abonnements" />
      <form className="flex gap-2 text-sm">
        <select name="statut" defaultValue={sp.statut ?? ""} className="h-9 rounded-md border bg-background px-2" aria-label="Statut">
          <option value="">Tous les statuts</option>
          {Object.entries(SUBSCRIPTION_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md border px-3">Filtrer</button>
      </form>
      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle="Aucun abonnement"
        columns={[
          { key: "user", header: "Compte", cell: (r) => (<div><span className="font-medium">{r.userEmail}</span>{r.professionalName && <p className="text-xs text-muted-foreground">fiche : {r.professionalName}</p>}</div>) },
          { key: "plan", header: "Offre", cell: (r) => `${r.planName} · ${formatEuros(r.priceMonthlyCents)}` },
          { key: "status", header: "Statut", cell: (r) => (<div className="flex flex-wrap gap-1"><StatusBadge tone={r.status === "active" || r.status === "trialing" ? "success" : r.status === "past_due" ? "warning" : "neutral"}>{SUBSCRIPTION_STATUS_LABELS[r.status as SubscriptionStatus] ?? r.status}</StatusBadge>{r.cancelAtPeriodEnd && <StatusBadge tone="warning">fin à l'échéance</StatusBadge>}{(r.provider === "mock" || r.userIsDemo) && <StatusBadge tone="neutral" dot={false}>démo</StatusBadge>}</div>) },
          { key: "period", header: "Fin de période", cell: (r) => <span className="text-muted-foreground">{dateTime(r.currentPeriodEnd)}</span> },
          { key: "created", header: "Depuis", cell: (r) => <span className="text-muted-foreground">{dateTime(r.createdAt)}</span> },
        ]}
      />
    </div>
  );
}
