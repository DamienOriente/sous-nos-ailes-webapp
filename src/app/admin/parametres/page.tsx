import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env, stripeConfigured } from "@/lib/env";
import { listSettings, SETTING_DEFINITIONS } from "@/modules/admin/application/settings-service";
import { requireAdminPage } from "../_lib/admin-page";
import { updateSettingAction } from "./actions";

export const dynamic = "force-dynamic";

const GROUP_LABELS = { legal: "Variables légales (mentions, CGV…)", retention: "Rétention des données", billing: "Facturation", directory: "Annuaire", moderation: "Modération" } as const;

export default async function SettingsPage() {
  const { twoFactorWarning } = await requireAdminPage("admin.settings.manage", "/admin/parametres");
  const rows = await listSettings();
  const value = (key: string) => rows.find((r) => r.key === key)?.value;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Paramètres" description="Variables résolues dans les pages éditoriales, délais de rétention appliqués par le worker, et interrupteurs produit. Chaque modification est journalisée." />
      <TwoFactorBanner show={twoFactorWarning} />
      <Card className="gap-2 p-6 text-sm">
        <h2 className="font-semibold">Environnement (lecture seule)</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div className="flex justify-between gap-2"><dt>Indexation moteurs (INDEXING_ENABLED)</dt><dd>{env.INDEXING_ENABLED ? <StatusBadge tone="success">activée</StatusBadge> : <StatusBadge tone="neutral">désactivée</StatusBadge>}</dd></div>
          <div className="flex justify-between gap-2"><dt>Mode démo (DEMO_MODE)</dt><dd>{env.DEMO_MODE ? <StatusBadge tone="warning">oui</StatusBadge> : <StatusBadge tone="neutral">non</StatusBadge>}</dd></div>
          <div className="flex justify-between gap-2"><dt>Stripe</dt><dd>{stripeConfigured ? <StatusBadge tone="success">clé configurée</StatusBadge> : <StatusBadge tone="neutral">non configuré (mock)</StatusBadge>}</dd></div>
          <div className="flex justify-between gap-2"><dt>APP_ENV</dt><dd><code>{env.APP_ENV}</code></dd></div>
        </dl>
      </Card>
      {(Object.keys(GROUP_LABELS) as Array<keyof typeof GROUP_LABELS>).map((group) => (
        <Card key={group} className="gap-4 p-6">
          <h2 className="font-semibold">{GROUP_LABELS[group]}</h2>
          {group === "billing" && <p className="text-xs text-muted-foreground">« Paiement réel activé » ne suffit pas : il faut aussi des clés Stripe live, des CGV validées, un médiateur désigné et des mentions légales complètes (voir docs/billing.md).</p>}
          <ul className="divide-y">
            {SETTING_DEFINITIONS.filter((d) => d.group === group).map((d) => {
              const v = value(d.key);
              return (
                <li key={d.key} className="py-3">
                  <ActionForm action={updateSettingAction} successMessage="Paramètre enregistré." className="flex flex-wrap items-end gap-3 space-y-0">
                    <input type="hidden" name="key" value={d.key} />
                    <div className="flex-1 min-w-64 space-y-1">
                      <Label htmlFor={d.key}>
                        {d.label} <code className="text-xs text-muted-foreground">{d.key}</code>
                      </Label>
                      {d.kind === "boolean" ? (
                        <label className="flex items-center gap-2 text-sm">
                          <input id={d.key} type="checkbox" name="value" value="true" defaultChecked={v === true} /> Activé
                        </label>
                      ) : d.kind === "integer" ? (
                        <Input id={d.key} name="value" type="number" min={d.min} max={d.max} defaultValue={typeof v === "number" ? v : ""} />
                      ) : (
                        <Input id={d.key} name="value" defaultValue={typeof v === "string" ? v : ""} className={typeof v === "string" && v.startsWith("[") ? "border-warning" : undefined} />
                      )}
                    </div>
                    <ActionSubmit size="sm" variant="outline">Enregistrer</ActionSubmit>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
