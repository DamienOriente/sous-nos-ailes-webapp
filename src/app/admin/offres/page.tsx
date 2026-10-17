import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEuros } from "@/lib/utils";
import { FEATURES, type FeatureKey } from "@/modules/billing/domain/plans";
import { listPlansAdmin } from "@/modules/billing/application/billing-admin";
import { requireAdminPage } from "../_lib/admin-page";
import { createPlanAction, savePlanFeaturesAction, updatePlanAction } from "./actions";

export const dynamic = "force-dynamic";

const SUBNAV = [
  { href: "/admin/offres", label: "Plans et fonctionnalités" },
  { href: "/admin/offres/promos", label: "Codes promo" },
  { href: "/admin/offres/sponsorises", label: "Placements sponsorisés" },
  { href: "/admin/offres/abonnements", label: "Abonnements" },
  { href: "/admin/offres/evenements", label: "Journal des évènements" },
];

export function OffersSubnav({ current }: { current: string }) {
  return (
    <nav aria-label="Offres" className="flex flex-wrap gap-2 text-sm">
      {SUBNAV.map((s) => (
        <Link key={s.href} href={s.href} className={`rounded-full border px-3 py-1 ${current === s.href ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted"}`} aria-current={current === s.href ? "page" : undefined}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function OffersPage() {
  const { actor, twoFactorWarning } = await requireAdminPage("admin.plans.manage", "/admin/offres");
  const plans = await listPlansAdmin(actor);
  const featureKeys = Object.keys(FEATURES) as FeatureKey[];
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Monétisation" title="Offres et abonnements" description="Prix, activation et matrice des fonctionnalités. Modifier un plan ne change jamais un abonnement en cours : les abonnés conservent leur prix jusqu'à résiliation." />
      <TwoFactorBanner show={twoFactorWarning} />
      <OffersSubnav current="/admin/offres" />
      <div className="grid gap-6 lg:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id} className="gap-4 p-6" data-plan={p.key}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">
                {p.name} <code className="text-xs text-muted-foreground">{p.key}</code>
              </h2>
              <div className="flex gap-1">
                <StatusBadge tone="neutral" dot={false}>{p.audience}</StatusBadge>
                {p.isDefault && <StatusBadge tone="primary" dot={false}>défaut</StatusBadge>}
                {!p.isActive && <StatusBadge tone="warning">inactif</StatusBadge>}
              </div>
            </div>
            {p.activeSubscriptions > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-xs">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {p.activeSubscriptions} abonnement(s) actif(s) sur ce plan. Un changement de prix ne les modifie pas (nouveau prix Stripe créé au prochain paiement) ; la modification est journalisée.
              </p>
            )}
            <ActionForm action={updatePlanAction} successMessage="Plan enregistré (abonnements existants inchangés)." className="space-y-3">
              <input type="hidden" name="planId" value={p.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor={`name-${p.id}`}>Nom</Label>
                  <Input id={`name-${p.id}`} name="name" defaultValue={p.name} required minLength={2} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`price-${p.id}`}>Prix mensuel TTC (€)</Label>
                  <Input id={`price-${p.id}`} name="priceEuros" type="number" step="0.01" min={0} defaultValue={(p.priceMonthlyCents / 100).toFixed(2)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor={`desc-${p.id}`}>Description</Label>
                  <Textarea id={`desc-${p.id}`} name="description" rows={2} defaultValue={p.description} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`order-${p.id}`}>Ordre</Label>
                  <Input id={`order-${p.id}`} name="sortOrder" type="number" defaultValue={p.sortOrder} />
                </div>
                <div className="flex flex-col justify-end gap-1 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={p.isActive} /> Actif (proposé à la souscription)</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="isDefault" defaultChecked={p.isDefault} /> Plan par défaut de l'audience</label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Actuel : {formatEuros(p.priceMonthlyCents)} · Stripe price : {p.stripePriceId ?? "créé au premier paiement"}
              </p>
              <ActionSubmit size="sm">Enregistrer le plan</ActionSubmit>
            </ActionForm>
            <details>
              <summary className="cursor-pointer text-sm font-medium">Fonctionnalités et limites</summary>
              <ActionForm action={savePlanFeaturesAction} successMessage="Fonctionnalités enregistrées." className="mt-3 space-y-2">
                <input type="hidden" name="planId" value={p.id} />
                <ul className="divide-y text-sm">
                  {featureKeys.map((k) => {
                    const f = p.features[k];
                    return (
                      <li key={k} className="flex items-center justify-between gap-2 py-1.5">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name={`feature:${k}`} defaultChecked={f?.enabled ?? false} /> {FEATURES[k]} <code className="text-xs text-muted-foreground">{k}</code>
                        </label>
                        <Input name={`limit:${k}`} type="number" min={0} defaultValue={f?.limit ?? ""} placeholder="∞" className="h-8 w-20" aria-label={`Limite ${FEATURES[k]}`} />
                      </li>
                    );
                  })}
                </ul>
                <ActionSubmit size="sm" variant="outline">Enregistrer la matrice</ActionSubmit>
              </ActionForm>
            </details>
          </Card>
        ))}
      </div>
      <Card className="gap-3 p-6">
        <h2 className="font-semibold">Créer un plan (inactif par défaut)</h2>
        <ActionForm action={createPlanAction} successMessage="Plan créé." resetOnSuccess className="grid gap-3 sm:grid-cols-4">
          <Input name="key" placeholder="clé (ex. organizer_pro)" required pattern="[a-z][a-z0-9_]+" aria-label="Clé" />
          <Input name="name" placeholder="Nom" required aria-label="Nom" />
          <select name="audience" className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Audience">
            <option value="organizer">organizer</option>
            <option value="professional">professional</option>
          </select>
          <Input name="priceEuros" type="number" step="0.01" min={0} placeholder="Prix €/mois" aria-label="Prix" />
          <Input name="description" placeholder="Description" className="sm:col-span-3" aria-label="Description" />
          <Button type="submit" variant="outline">Créer</Button>
        </ActionForm>
      </Card>
    </div>
  );
}
