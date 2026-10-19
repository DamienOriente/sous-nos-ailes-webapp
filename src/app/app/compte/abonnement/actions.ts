"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import type { CheckoutState } from "@/components/billing/checkout-return-poller";
import { getEffectivePlan } from "@/modules/billing/application/entitlements";
import { agencyReturnPath, completeMockAgencyCheckout } from "@/modules/billing/application/agency-billing";
import { cancelAtPeriodEnd, completeMockCheckout, openCustomerPortal, resumeSubscription, simulateMockPeriodEnd, startCheckout } from "@/modules/billing/application/subscription-service";

const audienceSchema = z.enum(["organizer", "professional"]);
const checkoutSchema = z.object({
  planKey: z.string().min(1).max(60),
  audience: audienceSchema,
  professionalId: z.uuid().optional().or(z.literal("")),
  promoCode: z.string().max(40).optional().or(z.literal("")),
});

function revalidate(professionalId?: string | null) {
  revalidatePath("/app/compte/abonnement");
  if (professionalId) revalidatePath(`/app/pro/${professionalId}/abonnement`);
}

export async function startCheckoutAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Offre invalide.");
    const { planKey, audience, professionalId, promoCode } = parsed.data;
    const res = await startCheckout(actor, { planKey, audience, professionalId: professionalId || null, promoCode: promoCode || null });
    return { ok: true, data: { redirectTo: res.url } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function completeMockCheckoutAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = checkoutSchema.extend({ outcome: z.enum(["success", "failure"]) }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Paramètres invalides.");
    const { planKey, audience, professionalId, promoCode, outcome } = parsed.data;
    const res = await completeMockCheckout(actor, { planKey, audience, professionalId: professionalId || null, promoCode: promoCode || null, outcome });
    revalidate(professionalId || null);
    const params = new URLSearchParams({ audience, mock: outcome });
    if (professionalId) params.set("professionalId", professionalId);
    if (res.subscriptionId) params.set("session_id", `mock_${res.subscriptionId}`);
    return { ok: true, data: { redirectTo: `/app/compte/abonnement/retour?${params.toString()}` } };
  } catch (e) {
    return toActionError(e);
  }
}

const agencyMockSchema = z.object({
  organizationId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(500),
  professionalId: z.uuid().optional().or(z.literal("")),
  outcome: z.enum(["success", "failure"]),
});

/** Mock provider for the agency subscription (quantity = listings beyond the first). */
export async function completeMockAgencyCheckoutAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = agencyMockSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError("Paramètres invalides.");
    const { organizationId, quantity, professionalId, outcome } = parsed.data;
    await completeMockAgencyCheckout(actor, { organizationId, quantity, professionalId: professionalId || null, outcome });
    revalidatePath("/app/pro", "layout");
    if (outcome === "failure") return { ok: true, data: { redirectTo: professionalId ? `/app/pro/${professionalId}/ajout-agence` : "/app/pro" } };
    return { ok: true, data: { redirectTo: agencyReturnPath(professionalId || null) } };
  } catch (e) {
    return toActionError(e);
  }
}

const subSchema = z.object({ subscriptionId: z.uuid(), professionalId: z.uuid().optional().or(z.literal("")) });

export async function cancelSubscriptionAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = subSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError();
    await cancelAtPeriodEnd(actor, parsed.data.subscriptionId);
    revalidate(parsed.data.professionalId || null);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function resumeSubscriptionAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = subSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError();
    await resumeSubscription(actor, parsed.data.subscriptionId);
    revalidate(parsed.data.professionalId || null);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function simulatePeriodEndAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = subSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new ValidationError();
    await simulateMockPeriodEnd(actor, parsed.data.subscriptionId);
    revalidate(parsed.data.professionalId || null);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function openPortalAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const back = typeof formData.get("returnPath") === "string" && String(formData.get("returnPath")).startsWith("/app/") ? String(formData.get("returnPath")) : "/app/compte/abonnement";
    const res = await openCustomerPortal(actor, back);
    return { ok: true, data: { redirectTo: res.url } };
  } catch (e) {
    return toActionError(e);
  }
}

/** Polled by the return page: the only source of truth is the entitlement resolved from processed events. */
export async function checkSubscriptionStateAction(audience: "organizer" | "professional", professionalId: string | null): Promise<ActionResult<CheckoutState>> {
  try {
    const actor = await requireActorOrThrow();
    const plan = await getEffectivePlan(actor.userId, audienceSchema.parse(audience), professionalId);
    return { ok: true, data: { active: plan.isPaid, planName: plan.planName, status: plan.status } };
  } catch (e) {
    return toActionError(e);
  }
}
