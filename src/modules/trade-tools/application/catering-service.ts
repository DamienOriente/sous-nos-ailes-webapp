import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { cateringMenus, cateringPlans, cateringServiceSteps, eventChannels, eventGuests } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { getDietaryCounts } from "@/modules/childcare/application/dietary";
import { requireTradeToolAccess } from "./access";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => (v ? v : null));

export const cateringPlanSchema = z.object({
  manualAdults: z.coerce.number().int().min(0).max(10_000).default(0),
  manualChildren: z.coerce.number().int().min(0).max(10_000).default(0),
  cocktail: z.coerce.number().int().min(0).max(10_000).default(0),
  dinner: z.coerce.number().int().min(0).max(10_000).default(0),
  brunch: z.coerce.number().int().min(0).max(10_000).default(0),
  deliveryNotes: optionalText(4000),
  equipmentNotes: optionalText(4000),
  constraints: optionalText(4000),
});

export const MENU_MOMENTS = ["cocktail", "dinner", "brunch", "children", "other"] as const;
export const MENU_MOMENT_LABELS: Record<(typeof MENU_MOMENTS)[number], string> = { cocktail: "Cocktail", dinner: "Dîner", brunch: "Brunch", children: "Menu enfants", other: "Autre" };

export const menuSchema = z.object({
  moment: z.enum(MENU_MOMENTS).default("dinner"),
  name: z.string().trim().min(1).max(160),
  description: optionalText(4000),
  pricePerCoverCents: z.coerce.number().int().min(0).max(100_000_00).optional().nullable(),
});

export const serviceStepSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional().nullable(),
    notes: optionalText(2000),
  })
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, { message: "La fin doit être après le début.", path: ["endsAt"] });

export async function getCateringOverview(actor: Actor, eventId: string, executor: DbExecutor = db) {
  const tool = await requireTradeToolAccess(actor, eventId, "catering", executor);
  const [plan] = await executor.select().from(cateringPlans).where(eq(cateringPlans.eventId, eventId)).limit(1);
  const [counts] = await executor
    .select({
      adults: sql<number>`count(*) filter (where ${eventGuests.isChild} = false)::int`,
      children: sql<number>`count(*) filter (where ${eventGuests.isChild} = true)::int`,
    })
    .from(eventGuests)
    .where(and(eq(eventGuests.eventId, eventId), eq(eventGuests.rsvpStatus, "accepted")));
  const [menus, steps, dietary, channel] = await Promise.all([
    executor.select().from(cateringMenus).where(eq(cateringMenus.eventId, eventId)).orderBy(asc(cateringMenus.sortOrder), asc(cateringMenus.createdAt)),
    executor.select().from(cateringServiceSteps).where(eq(cateringServiceSteps.eventId, eventId)).orderBy(asc(cateringServiceSteps.startsAt)),
    getDietaryCounts(actor, eventId, executor),
    executor.select({ id: eventChannels.id }).from(eventChannels).where(eq(eventChannels.eventId, eventId)).limit(1),
  ]);
  const acceptedAdults = counts?.adults ?? 0;
  const acceptedChildren = counts?.children ?? 0;
  return {
    tool,
    plan: plan ?? null,
    headcount: {
      acceptedAdults,
      acceptedChildren,
      registeredChildren: dietary.children,
      manualAdults: plan?.manualAdults ?? 0,
      manualChildren: plan?.manualChildren ?? 0,
      totalAdults: acceptedAdults + (plan?.manualAdults ?? 0),
      totalChildren: Math.max(acceptedChildren, dietary.children) + (plan?.manualChildren ?? 0),
    },
    mealSplit: plan?.mealSplit ?? { cocktail: 0, dinner: 0, brunch: 0 },
    menus,
    steps,
    dietary: dietary.rows,
    channelHref: channel[0] ? `/app/evenements/${eventId}/messages/${channel[0].id}` : `/app/evenements/${eventId}/messages`,
  };
}

export async function upsertCateringPlan(actor: Actor, eventId: string, input: z.infer<typeof cateringPlanSchema>, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "catering", executor);
  const values = {
    eventId,
    manualAdults: input.manualAdults,
    manualChildren: input.manualChildren,
    mealSplit: { cocktail: input.cocktail, dinner: input.dinner, brunch: input.brunch },
    deliveryNotes: input.deliveryNotes,
    equipmentNotes: input.equipmentNotes,
    constraints: input.constraints,
    updatedByUserId: actor.userId,
  };
  await executor.insert(cateringPlans).values(values).onConflictDoUpdate({ target: cateringPlans.eventId, set: values });
}

export async function addMenu(actor: Actor, eventId: string, input: z.infer<typeof menuSchema>, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "catering", executor);
  await executor.insert(cateringMenus).values({ ...input, eventId });
}

export async function updateMenu(actor: Actor, eventId: string, menuId: string, input: z.infer<typeof menuSchema>, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "catering", executor);
  const res = await executor.update(cateringMenus).set(input).where(and(eq(cateringMenus.id, menuId), eq(cateringMenus.eventId, eventId))).returning({ id: cateringMenus.id });
  if (!res.length) throw new NotFoundError();
}

export async function deleteMenu(actor: Actor, eventId: string, menuId: string, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "catering", executor);
  await executor.delete(cateringMenus).where(and(eq(cateringMenus.id, menuId), eq(cateringMenus.eventId, eventId)));
}

export async function addServiceStep(actor: Actor, eventId: string, input: z.infer<typeof serviceStepSchema>, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "catering", executor);
  await executor.insert(cateringServiceSteps).values({ ...input, eventId });
}

export async function deleteServiceStep(actor: Actor, eventId: string, stepId: string, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "catering", executor);
  await executor.delete(cateringServiceSteps).where(and(eq(cateringServiceSteps.id, stepId), eq(cateringServiceSteps.eventId, eventId)));
}
