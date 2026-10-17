import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { AdminTable, dateTime } from "@/components/admin/admin-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listPromoCodes } from "@/modules/billing/application/promo-codes";
import { requireAdminPage } from "../../_lib/admin-page";
import { createPromoAction, togglePromoAction } from "../actions";
import { OffersSubnav } from "../page";

export const dynamic = "force-dynamic";

export default async function PromoCodesPage() {
  const { actor } = await requireAdminPage("admin.plans.manage", "/admin/offres/promos");
  const rows = await listPromoCodes(actor);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Monétisation" title="Codes promo" description="Réduction en pourcentage ou en montant, durée limitée, plafond d'utilisations. Avec Stripe, renseignez l'identifiant du coupon créé dans le dashboard pour l'appliquer au checkout." />
      <OffersSubnav current="/admin/offres/promos" />
      <Card className="gap-3 p-6">
        <h2 className="font-semibold">Nouveau code</h2>
        <ActionForm action={createPromoAction} successMessage="Code créé." resetOnSuccess className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Input name="code" placeholder="CODE" required className="uppercase" aria-label="Code" />
          <Input name="description" placeholder="Description interne" aria-label="Description" />
          <Input name="percentOff" type="number" min={1} max={100} placeholder="% de réduction" aria-label="Pourcentage" />
          <Input name="amountOffEuros" type="number" min={1} placeholder="ou montant €" aria-label="Montant" />
          <Input name="durationMonths" type="number" min={1} placeholder="Durée (mois)" aria-label="Durée en mois" />
          <Input name="maxRedemptions" type="number" min={1} placeholder="Utilisations max" aria-label="Utilisations max" />
          <Input name="validFrom" type="date" aria-label="Valide à partir du" />
          <Input name="validUntil" type="date" aria-label="Valide jusqu'au" />
          <ActionSubmit variant="outline">Créer le code</ActionSubmit>
        </ActionForm>
      </Card>
      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle="Aucun code promo"
        columns={[
          { key: "code", header: "Code", cell: (r) => (<div><code className="font-semibold">{r.code}</code>{r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}</div>) },
          { key: "value", header: "Réduction", cell: (r) => (r.percentOff ? `${r.percentOff} %` : r.amountOffCents ? `${(r.amountOffCents / 100).toFixed(2)} €` : "—") + (r.durationMonths ? ` pendant ${r.durationMonths} mois` : "") },
          { key: "usage", header: "Utilisations", cell: (r) => <span className="tabular-nums">{r.redemptionCount}{r.maxRedemptions ? ` / ${r.maxRedemptions}` : ""}</span> },
          { key: "validity", header: "Validité", cell: (r) => <span className="text-muted-foreground">{r.validFrom ? dateTime(r.validFrom) : "—"} → {r.validUntil ? dateTime(r.validUntil) : "—"}</span> },
          {
            key: "active",
            header: "Statut",
            cell: (r) => (
              <ActionForm action={togglePromoAction} className="flex items-center gap-2 space-y-0">
                <input type="hidden" name="promoId" value={r.id} />
                <input type="hidden" name="isActive" value={r.isActive ? "false" : "true"} />
                {r.isActive ? <StatusBadge tone="success">actif</StatusBadge> : <StatusBadge tone="neutral">inactif</StatusBadge>}
                <ActionSubmit size="sm" variant="ghost">{r.isActive ? "Désactiver" : "Activer"}</ActionSubmit>
              </ActionForm>
            ),
          },
        ]}
      />
    </div>
  );
}
