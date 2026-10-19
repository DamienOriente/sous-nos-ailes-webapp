import { desc, eq, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { promoCodes } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireGlobalPermission } from "@/modules/authorization";
import { applyPromo, checkPromoValidity, normalizePromoCode } from "@/modules/billing/domain/promo";
import { recordAudit } from "@/modules/admin/application/audit";

export type PromoValidation = { ok: true; promo: typeof promoCodes.$inferSelect; discountedCents: (price: number) => number } | { ok: false; message: string };

const REASON_MESSAGES = {
  inactive: "Ce code n'est plus actif.",
  not_started: "Ce code n'est pas encore valable.",
  expired: "Ce code a expiré.",
  exhausted: "Ce code a atteint son nombre maximal d'utilisations.",
} as const;

export async function validatePromoCode(code: string, executor: DbExecutor = db): Promise<PromoValidation> {
  const normalized = normalizePromoCode(code);
  if (!normalized) return { ok: false, message: "Code vide." };
  const [promo] = await executor.select().from(promoCodes).where(eq(promoCodes.code, normalized)).limit(1);
  if (!promo) return { ok: false, message: "Code promo inconnu." };
  const check = checkPromoValidity(promo);
  if (!check.ok) return { ok: false, message: REASON_MESSAGES[check.reason] };
  return { ok: true, promo, discountedCents: (price) => applyPromo(price, promo) };
}

export async function incrementPromoRedemption(promoId: string, executor: DbExecutor = db): Promise<void> {
  await executor.update(promoCodes).set({ redemptionCount: sql`${promoCodes.redemptionCount} + 1` }).where(eq(promoCodes.id, promoId));
}

// ── Admin ────────────────────────────────────────────────────────────────────
export type PromoInput = {
  code: string;
  description?: string | null;
  percentOff?: number | null;
  amountOffCents?: number | null;
  durationMonths?: number | null;
  maxRedemptions?: number | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  isActive?: boolean;
};

function assertPromoInput(input: PromoInput): void {
  if (!normalizePromoCode(input.code)) throw new ValidationError("Code requis.");
  const pct = input.percentOff ?? null;
  const amt = input.amountOffCents ?? null;
  if ((pct === null || pct <= 0) && (amt === null || amt <= 0)) throw new ValidationError("Indiquez un pourcentage ou un montant de réduction.");
  if (pct !== null && (pct < 0 || pct > 100)) throw new ValidationError("Pourcentage entre 0 et 100.");
  if (input.validFrom && input.validUntil && input.validFrom > input.validUntil) throw new ValidationError("La date de fin précède la date de début.");
}

export async function listPromoCodes(actor: Actor) {
  requireGlobalPermission(actor, "admin.plans.manage");
  return db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
}

export async function createPromoCode(actor: Actor, input: PromoInput, executor: DbExecutor = db) {
  requireGlobalPermission(actor, "admin.plans.manage");
  assertPromoInput(input);
  const code = normalizePromoCode(input.code);
  const [existing] = await executor.select({ id: promoCodes.id }).from(promoCodes).where(eq(promoCodes.code, code)).limit(1);
  if (existing) throw new ConflictError("Ce code existe déjà.");
  const [row] = await executor
    .insert(promoCodes)
    .values({
      code,
      description: input.description ?? null,
      percentOff: input.percentOff && input.percentOff > 0 ? input.percentOff : null,
      amountOffCents: input.amountOffCents && input.amountOffCents > 0 ? input.amountOffCents : null,
      durationMonths: input.durationMonths ?? null,
      maxRedemptions: input.maxRedemptions ?? null,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      isActive: input.isActive ?? true,
    })
    .returning({ id: promoCodes.id });
  await recordAudit(executor, { actorUserId: actor.userId, action: "billing.promo.created", resourceType: "promo_code", resourceId: row?.id ?? null, metadata: { code } });
  return row;
}

export async function setPromoActive(actor: Actor, promoId: string, isActive: boolean, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(actor, "admin.plans.manage");
  const [row] = await executor.update(promoCodes).set({ isActive }).where(eq(promoCodes.id, promoId)).returning({ id: promoCodes.id });
  if (!row) throw new NotFoundError();
  await recordAudit(executor, { actorUserId: actor.userId, action: isActive ? "billing.promo.activated" : "billing.promo.deactivated", resourceType: "promo_code", resourceId: promoId });
}
