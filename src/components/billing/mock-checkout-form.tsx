import { ActionForm, ActionSubmit, type FormAction } from "@/components/admin/action-form";
import { Card } from "@/components/ui/card";
import { formatEuros } from "@/lib/utils";

/** Replacement for Stripe Checkout when no key is configured. Unmistakably labelled. */
export function MockCheckoutForm({ action, planName, priceCents, discountedCents, promo, hidden }: { action: FormAction; planName: string; priceCents: number; discountedCents: number | null; promo: string | null; hidden: Record<string, string> }) {
  return (
    <Card className="gap-6 border-dashed border-warning/60 bg-warning/5 p-6 sm:p-8" data-testid="mock-checkout">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Souscrire à {planName}</h1>
        <p className="text-sm font-medium text-warning-foreground">Paiement simulé : environnement de démonstration</p>
        <p className="text-sm text-muted-foreground text-pretty">Aucune carte n'est demandée et aucun débit n'a lieu. Ce simulateur produit les mêmes évènements que Stripe, pour tester le parcours de bout en bout.</p>
      </div>
      <dl className="rounded-xl bg-background p-4 text-sm">
        <div className="flex justify-between">
          <dt>Abonnement mensuel</dt>
          <dd className="font-medium">{formatEuros(priceCents)} TTC</dd>
        </div>
        {discountedCents !== null && promo && (
          <div className="mt-1 flex justify-between text-success">
            <dt>Code {promo}</dt>
            <dd className="font-medium">{formatEuros(discountedCents)} TTC le premier mois</dd>
          </div>
        )}
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        <ActionForm action={action} className="space-y-0">
          {Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="outcome" value="success" />
          <ActionSubmit className="w-full" pendingLabel="Traitement…">
            Simuler un paiement réussi
          </ActionSubmit>
        </ActionForm>
        <ActionForm action={action} className="space-y-0">
          {Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="outcome" value="failure" />
          <ActionSubmit variant="outline" className="w-full" pendingLabel="Traitement…">
            Simuler un échec
          </ActionSubmit>
        </ActionForm>
      </div>
    </Card>
  );
}
