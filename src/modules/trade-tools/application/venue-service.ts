import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { eventDocuments, eventMembers, eventMilestones, eventProfessionals, professionalCategories, users, venueLogistics, venueSpaceAllocations, venueSpaces } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireTradeToolAccess } from "./access";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => (v ? v : null));

export const SPACE_USAGES = ["ceremony", "cocktail", "dinner", "dancefloor", "kids", "logistics", "other"] as const;
export const SPACE_USAGE_LABELS: Record<(typeof SPACE_USAGES)[number], string> = {
  ceremony: "Cérémonie",
  cocktail: "Cocktail",
  dinner: "Dîner",
  dancefloor: "Piste / soirée",
  kids: "Espace enfants",
  logistics: "Logistique / office",
  other: "Autre",
};

export const spaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  capacity: z.coerce.number().int().min(0).max(100_000).optional().nullable(),
  usage: z.enum(SPACE_USAGES).default("other"),
  notes: optionalText(2000),
});

export const allocationSchema = z
  .object({
    spaceId: z.uuid(),
    milestoneId: z.uuid().optional().nullable(),
    label: z.string().trim().min(1).max(160),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional().nullable(),
  })
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, { message: "La fin doit être après le début.", path: ["endsAt"] });

export const logisticsSchema = z.object({
  electricalNotes: optionalText(4000),
  accessNotes: optionalText(4000),
  noiseNotes: optionalText(4000),
  installationPlan: optionalText(8000),
  otherConstraints: optionalText(4000),
});

export async function getVenueOverview(actor: Actor, eventId: string, executor: DbExecutor = db) {
  const tool = await requireTradeToolAccess(actor, eventId, "venue", executor);
  const [spaces, allocations, logistics, milestones, providers, documents] = await Promise.all([
    executor.select().from(venueSpaces).where(eq(venueSpaces.eventId, eventId)).orderBy(asc(venueSpaces.sortOrder), asc(venueSpaces.name)),
    executor
      .select({ id: venueSpaceAllocations.id, spaceId: venueSpaceAllocations.spaceId, spaceName: venueSpaces.name, label: venueSpaceAllocations.label, startsAt: venueSpaceAllocations.startsAt, endsAt: venueSpaceAllocations.endsAt, milestoneId: venueSpaceAllocations.milestoneId })
      .from(venueSpaceAllocations)
      .innerJoin(venueSpaces, eq(venueSpaces.id, venueSpaceAllocations.spaceId))
      .where(eq(venueSpaceAllocations.eventId, eventId))
      .orderBy(asc(venueSpaceAllocations.startsAt)),
    executor.select().from(venueLogistics).where(eq(venueLogistics.eventId, eventId)).limit(1),
    executor.select({ id: eventMilestones.id, title: eventMilestones.title, startsAt: eventMilestones.startsAt }).from(eventMilestones).where(eq(eventMilestones.eventId, eventId)).orderBy(asc(eventMilestones.startsAt)),
    executor
      .select({
        id: eventProfessionals.id,
        name: users.name,
        externalName: eventProfessionals.externalName,
        category: professionalCategories.name,
        status: eventProfessionals.status,
        serviceStartsAt: eventProfessionals.serviceStartsAt,
        serviceEndsAt: eventProfessionals.serviceEndsAt,
      })
      .from(eventProfessionals)
      .leftJoin(eventMembers, eq(eventMembers.id, eventProfessionals.memberId))
      .leftJoin(users, eq(users.id, eventMembers.userId))
      .leftJoin(professionalCategories, eq(professionalCategories.id, eventProfessionals.categoryId))
      .where(eq(eventProfessionals.eventId, eventId)),
    executor
      .select({ id: eventDocuments.id, title: eventDocuments.title, kind: eventDocuments.kind, fileId: eventDocuments.fileId })
      .from(eventDocuments)
      .where(and(eq(eventDocuments.eventId, eventId), eq(eventDocuments.kind, "plan"))),
  ]);
  return { tool, spaces, allocations, logistics: logistics[0] ?? null, milestones, providers: providers.filter((p) => p.status === "confirmed" || p.status === "quoted"), documents };
}

export async function addSpace(actor: Actor, eventId: string, input: z.infer<typeof spaceSchema>, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "venue", executor);
  await executor.insert(venueSpaces).values({ ...input, eventId });
}

export async function deleteSpace(actor: Actor, eventId: string, spaceId: string, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "venue", executor);
  await executor.delete(venueSpaces).where(and(eq(venueSpaces.id, spaceId), eq(venueSpaces.eventId, eventId)));
}

export async function addAllocation(actor: Actor, eventId: string, input: z.infer<typeof allocationSchema>, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "venue", executor);
  const [space] = await executor.select({ id: venueSpaces.id }).from(venueSpaces).where(and(eq(venueSpaces.id, input.spaceId), eq(venueSpaces.eventId, eventId))).limit(1);
  if (!space) throw new NotFoundError();
  await executor.insert(venueSpaceAllocations).values({ ...input, eventId });
}

export async function deleteAllocation(actor: Actor, eventId: string, allocationId: string, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "venue", executor);
  await executor.delete(venueSpaceAllocations).where(and(eq(venueSpaceAllocations.id, allocationId), eq(venueSpaceAllocations.eventId, eventId)));
}

export async function upsertLogistics(actor: Actor, eventId: string, input: z.infer<typeof logisticsSchema>, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "venue", executor);
  const values = { ...input, eventId, updatedByUserId: actor.userId };
  await executor.insert(venueLogistics).values(values).onConflictDoUpdate({ target: venueLogistics.eventId, set: values });
}
