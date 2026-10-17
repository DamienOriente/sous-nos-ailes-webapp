import { AdminTable, dateTime } from "@/components/admin/admin-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { listRecentBillingEvents } from "@/modules/billing/application/billing-admin";
import { requireAdminPage } from "../../_lib/admin-page";
import { OffersSubnav } from "../page";

export const dynamic = "force-dynamic";

export default async function BillingEventsPage() {
  const { actor } = await requireAdminPage("admin.billing.view", "/admin/offres/evenements");
  const rows = await listRecentBillingEvents(actor, 100);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Monétisation" title="Journal des évènements de facturation" description="Registre idempotent : chaque évènement Stripe ou simulé est traité au plus une fois. Les erreurs de traitement sont conservées pour analyse et rejouées à la prochaine livraison." />
      <OffersSubnav current="/admin/offres/evenements" />
      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle="Aucun évènement"
        columns={[
          { key: "type", header: "Type", cell: (r) => <code className="text-xs">{r.type}</code> },
          { key: "provider", header: "Source", cell: (r) => <StatusBadge tone={r.provider === "stripe" ? "primary" : "neutral"} dot={false}>{r.provider}</StatusBadge> },
          { key: "id", header: "Identifiant", cell: (r) => <code className="text-xs text-muted-foreground">{r.externalEventId}</code> },
          { key: "processed", header: "Traitement", cell: (r) => (r.error ? <StatusBadge tone="danger">erreur : {r.error.slice(0, 60)}</StatusBadge> : r.processedAt ? <StatusBadge tone="success">traité</StatusBadge> : <StatusBadge tone="warning">en attente</StatusBadge>) },
          { key: "date", header: "Reçu le", cell: (r) => <span className="text-muted-foreground">{dateTime(r.createdAt)}</span> },
        ]}
      />
    </div>
  );
}
