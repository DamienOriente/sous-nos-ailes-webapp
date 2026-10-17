"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { FEATURES, type FeatureKey } from "@/modules/billing/domain/plans";
import { createPlan, setPlanFeature, updatePlan } from "@/modules/billing/application/billing-admin";
import { createPromoCode, setPromoActive } from "@/modules/billing/application/promo-codes";
import { createFeaturedPlacement, setFeaturedPlacementActive } from "@/modules/billing/application/featured-placements";
import { bool, int, optStr, str } from "@/app/admin/_lib/admin-page";

function revalidate() {
  revalidatePath("/admin/offres");
  revalidatePath("/tarifs");
  revalidatePath("/app/compte/abonnement");
}

export async function updatePlanAction(formData: FormData): Promise<ActionResult<{ affectedSubscriptions: number }>> {
  try {
    const actor = await requireActorOrThrow();
    const planId = z.uuid().parse(str(formData, "planId"));
    const euros = str(formData, "priceEuros").replace(",", ".");
    const price = euros ? Math.round(Number.parseFloat(euros) * 100) : undefined;
    if (price !== undefined && !Number.isFinite(price)) throw new ValidationError("Prix invalide.");
    const res = await updatePlan(actor, planId, { name: str(formData, "name"), description: str(formData, "description"), priceMonthlyCents: price, isActive: bool(formData, "isActive"), isDefault: bool(formData, "isDefault"), sortOrder: int(formData, "sortOrder") ?? undefined });
    revalidate();
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}

/** Feature matrix: one submit per plan with `feature:<key>` checkboxes and `limit:<key>` numbers. */
export async function savePlanFeaturesAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const planId = z.uuid().parse(str(formData, "planId"));
    for (const key of Object.keys(FEATURES) as FeatureKey[]) {
      const enabled = bool(formData, `feature:${key}`);
      const limit = int(formData, `limit:${key}`);
      await setPlanFeature(actor, planId, key, enabled, enabled ? limit : null);
    }
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createPlanAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const audience = str(formData, "audience") === "professional" ? "professional" : "organizer";
    const euros = str(formData, "priceEuros").replace(",", ".");
    await createPlan(actor, { key: str(formData, "key").trim(), name: str(formData, "name").trim(), audience, priceMonthlyCents: Math.round(Number.parseFloat(euros || "0") * 100), description: str(formData, "description") });
    revalidate();
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createPromoAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const toDate = (v: string | null) => (v ? new Date(v) : null);
    await createPromoCode(actor, {
      code: str(formData, "code"),
      description: optStr(formData, "description"),
      percentOff: int(formData, "percentOff"),
      amountOffCents: int(formData, "amountOffEuros") !== null ? (int(formData, "amountOffEuros") ?? 0) * 100 : null,
      durationMonths: int(formData, "durationMonths"),
      maxRedemptions: int(formData, "maxRedemptions"),
      validFrom: toDate(optStr(formData, "validFrom")),
      validUntil: toDate(optStr(formData, "validUntil")),
      isActive: true,
    });
    revalidatePath("/admin/offres/promos");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function togglePromoAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    await setPromoActive(actor, z.uuid().parse(str(formData, "promoId")), str(formData, "isActive") === "true");
    revalidatePath("/admin/offres/promos");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createPlacementAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    const startsAt = new Date(str(formData, "startsAt"));
    const endsAt = new Date(str(formData, "endsAt"));
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new ValidationError("Dates invalides.");
    await createFeaturedPlacement(actor, { professionalId: z.uuid().parse(str(formData, "professionalId")), categorySlug: optStr(formData, "categorySlug"), department: optStr(formData, "department"), startsAt, endsAt });
    revalidatePath("/admin/offres/sponsorises");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function togglePlacementAction(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const actor = await requireActorOrThrow();
    await setFeaturedPlacementActive(actor, z.uuid().parse(str(formData, "placementId")), str(formData, "isActive") === "true");
    revalidatePath("/admin/offres/sponsorises");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
