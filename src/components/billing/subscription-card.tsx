import { CalendarClock, CreditCard, ShieldCheck } from "lucide-react";
import { ActionForm, ActionSubmit, type FormAction } from "@/components/admin/action-form";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { formatDateFr, formatEuros } from "@/lib/utils";
import { SUBSCRIPTION_STATUS_LABELS, type SubscriptionStatus } from "@/modules/billing/domain/subscription-status";
import type { SubscriptionOverview } from "@/modules/billing/application/subscription-service";

const TONES: Record<SubscriptionStatus, "success" | "warning" | "danger" | "neutral" | "info"> = {
  active: "success",
  trialing: "info",
  past_due: "warning",
  canceled: "neutral",
  unpaid: "danger",
  incomplete: "warning",
  incomplete_expired: "danger",
  paused: "neutral",
};

/** Current plan + management actions (cancel at period end / resume / portal / simulate end in mock mode). */
export function SubscriptionCard({
  overview,
  actions,
}: {
  overview: SubscriptionOverview;
  actions: { cancel: FormAction; resume: FormAction; portal: FormAction; simulateEnd: FormAction };
}) {
  const { effective, subscription, provider } = overview;
  const status = (subscription?.status ?? "active") as SubscriptionStatus;
  return (
    <Card className="gap-5 p-6" data-testid="subscription-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">Votre offre</p>
          <h2 className="text-xl font-semibold" data-testid="current-plan">
            {effective.planName}
          </h2>
          {subscription ? <p className="text-sm text-muted-foreground">{formatEuros(subscription.priceMonthlyCents)} TTC / mois</p> : <p className="text-sm text-muted-foreground">Offre gratuite, sans engagement.</p>}
        </div>
        {subscription && <StatusBadge tone={TONES[status]}>{SUBSCRIPTION_STATUS_LABELS[status]}</StatusBadge>}
      </div>

      {subscription && (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <dt className="text-muted-foreground">{subscription.cancelAtPeriodEnd ? "Actif jusqu'au" : "Prochain renouvellement"}</dt>
              <dd className="font-medium" data-testid="period-end">
                {subscription.currentPeriodEnd ? formatDateFr(subscription.currentPeriodEnd) : "—"}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CreditCard className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <dt className="text-muted-foreground">Moyen de paiement</dt>
              <dd className="font-medium">{provider === "stripe" ? "Géré par Stripe" : "Paiement simulé (démonstration)"}</dd>
            </div>
          </div>
        </dl>
      )}

      {subscription?.cancelAtPeriodEnd && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm" data-testid="cancel-notice">
          Résiliation enregistrée : vos fonctionnalités restent disponibles jusqu'au {subscription.currentPeriodEnd ? formatDateFr(subscription.currentPeriodEnd) : "terme de la période"}. Vous pouvez reprendre l'abonnement d'ici là.
        </p>
      )}
      {status === "past_due" && (
        <p role="alert" className="rounded-lg bg-warning/20 px-3 py-2 text-sm">
          Le dernier prélèvement a échoué. Mettez à jour votre moyen de paiement pour conserver vos fonctionnalités après le {subscription?.currentPeriodEnd ? formatDateFr(subscription.currentPeriodEnd) : "terme"}.
        </p>
      )}

      {subscription && (
        <div className="flex flex-wrap gap-2">
          <input type="hidden" />
          {subscription.cancelAtPeriodEnd ? (
            <ActionForm action={actions.resume} successMessage="Abonnement repris." className="space-y-0">
              <input type="hidden" name="subscriptionId" value={subscription.id} />
              <ActionSubmit pendingLabel="Reprise…">Reprendre l'abonnement</ActionSubmit>
            </ActionForm>
          ) : (
            <ActionForm action={actions.cancel} successMessage="Résiliation enregistrée à l'échéance." className="space-y-0">
              <input type="hidden" name="subscriptionId" value={subscription.id} />
              <ActionSubmit variant="outline" pendingLabel="Résiliation…">
                Résilier à l'échéance
              </ActionSubmit>
            </ActionForm>
          )}
          <ActionForm action={actions.portal} className="space-y-0">
            <ActionSubmit variant="ghost" pendingLabel="Ouverture…">
              {provider === "stripe" ? "Gérer le paiement et les factures" : "Gérer (portail simulé)"}
            </ActionSubmit>
          </ActionForm>
          {provider === "mock" && subscription.provider === "mock" && (
            <ActionForm action={actions.simulateEnd} successMessage="Fin de période simulée." className="space-y-0">
              <input type="hidden" name="subscriptionId" value={subscription.id} />
              <ActionSubmit variant="ghost" size="sm" pendingLabel="Simulation…">
                Simuler la fin de période
              </ActionSubmit>
            </ActionForm>
          )}
        </div>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" aria-hidden="true" /> Paiement sécurisé par Stripe. Résiliation en ligne en 2 clics, effective à l'échéance.
      </p>
    </Card>
  );
}
