import { AlertTriangle } from "lucide-react";

/** Shown wherever a price is displayed while real payments are not enabled (no Stripe key or billing.live_enabled = false). */
export function LiveBillingBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p role="note" className="flex items-start gap-2 rounded-xl border border-warning/50 bg-warning/15 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden="true" />
      <span>
        <strong>Paiement réel non activé sur cet environnement.</strong> Les offres sont présentées à titre indicatif ; toute souscription passe par un paiement simulé ou par Stripe en mode test, sans aucun débit.
      </span>
    </p>
  );
}
