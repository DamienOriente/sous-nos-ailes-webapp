"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";

export type CheckoutState = { active: boolean; planName: string; status: string | null };

/**
 * After a checkout redirect we never trust the URL: the page polls the real
 * entitlement (resolved from processed events) until it turns active or we
 * give up and explain what to do.
 */
export function CheckoutReturnPoller({ check, manageHref, targetHref, targetLabel }: { check: () => Promise<ActionResult<CheckoutState>>; manageHref: string; targetHref?: string | null; targetLabel?: string | null }) {
  const [state, setState] = useState<CheckoutState | null>(null);
  const [attempts, setAttempts] = useState(0);
  const timedOut = attempts >= 30 && !state?.active;

  useEffect(() => {
    if (state?.active || timedOut) return;
    let cancelled = false;
    const tick = async () => {
      const res = await check();
      if (cancelled) return;
      if (res.ok) setState(res.data);
      setAttempts((a) => a + 1);
    };
    const id = setTimeout(tick, attempts === 0 ? 300 : 2000);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [attempts, check, state?.active, timedOut]);

  if (state?.active) {
    return (
      <div className="space-y-4 text-center" role="status" data-testid="checkout-confirmed">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Abonnement activé : {state.planName}</h2>
        <p className="text-muted-foreground">Vos fonctionnalités sont disponibles dès maintenant.</p>
        <div className="flex flex-wrap justify-center gap-2">
          {targetHref && (
            <Button asChild>
              <Link href={targetHref}>{targetLabel ?? "Continuer"}</Link>
            </Button>
          )}
          <Button asChild variant={targetHref ? "outline" : "default"}>
            <Link href={manageHref}>Voir mon abonnement</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (timedOut) {
    return (
      <div className="space-y-4 text-center" role="status">
        <TimerReset className="mx-auto size-12 text-warning-foreground" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Confirmation en attente</h2>
        <p className="text-muted-foreground text-pretty">
          Nous n'avons pas encore reçu la confirmation du paiement. Cela peut prendre quelques minutes ; vous recevrez une notification dès l'activation. Si vous avez été débité et que rien ne change d'ici une heure, contactez-nous.
        </p>
        <Button asChild variant="outline">
          <Link href={manageHref}>Retour à mon abonnement</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4 text-center" role="status" aria-live="polite" data-testid="checkout-pending">
      <Loader2 className="mx-auto size-10 animate-spin text-primary" aria-hidden="true" />
      <h2 className="text-xl font-semibold">Paiement en cours de confirmation…</h2>
      <p className="text-muted-foreground text-pretty">Nous attendons la confirmation du prestataire de paiement. Ne fermez pas cette page, elle se mettra à jour automatiquement.</p>
    </div>
  );
}
