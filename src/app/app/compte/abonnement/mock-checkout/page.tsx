import { notFound } from "next/navigation";
import { MockCheckoutForm } from "@/components/billing/mock-checkout-form";
import { stripeConfigured } from "@/lib/env";
import { requireActor } from "@/lib/session";
import { listPlans } from "@/modules/billing/application/subscription-service";
import { validatePromoCode } from "@/modules/billing/application/promo-codes";
import { completeMockCheckoutAction } from "../actions";

type Search = { plan?: string; audience?: string; professionalId?: string; promo?: string };

/** Only exists when Stripe is not configured. */
export default async function MockCheckoutPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireActor("/app/compte/abonnement");
  if (stripeConfigured) notFound();
  const sp = await searchParams;
  const audience = sp.audience === "professional" ? "professional" : "organizer";
  const plans = await listPlans(audience);
  const plan = plans.find((p) => p.key === sp.plan && p.priceMonthlyCents > 0);
  if (!plan) notFound();
  const promo = sp.promo ? await validatePromoCode(sp.promo) : null;
  const hidden: Record<string, string> = { planKey: plan.key, audience };
  if (sp.professionalId) hidden.professionalId = sp.professionalId;
  if (promo?.ok) hidden.promoCode = promo.promo.code;
  return (
    <div className="mx-auto max-w-2xl">
      <MockCheckoutForm action={completeMockCheckoutAction} planName={plan.name} priceCents={plan.priceMonthlyCents} discountedCents={promo?.ok ? promo.discountedCents(plan.priceMonthlyCents) : null} promo={promo?.ok ? promo.promo.code : null} hidden={hidden} />
    </div>
  );
}
