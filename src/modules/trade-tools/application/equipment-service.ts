import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { equipmentItems, eventMembers, professionalCategories, users } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireTradeToolAccess } from "./access";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => (v ? v : null));

export const PROVIDED_BY = ["provider", "venue", "organizer", "rental"] as const;
export const PROVIDED_BY_LABELS: Record<(typeof PROVIDED_BY)[number], string> = { provider: "Prestataire", venue: "Lieu", organizer: "Organisateur", rental: "Location" };

export const equipmentSchema = z.object({
  name: z.string().trim().min(1).max(160),
  quantity: z.coerce.number().int().min(1).max(10_000).default(1),
  providedBy: z.enum(PROVIDED_BY).default("provider"),
  powerNeeds: optionalText(300),
  notes: optionalText(1000),
  /** Organisers may file a line under a provider member; providers always own their own lines. */
  memberId: z.uuid().optional().nullable(),
});

export async function getEquipmentOverview(actor: Actor, eventId: string, executor: DbExecutor = db) {
  const tool = await requireTradeToolAccess(actor, eventId, "equipment", executor);
  const items = await executor
    .select({
      id: equipmentItems.id,
      name: equipmentItems.name,
      quantity: equipmentItems.quantity,
      providedBy: equipmentItems.providedBy,
      powerNeeds: equipmentItems.powerNeeds,
      notes: equipmentItems.notes,
      memberId: equipmentItems.memberId,
      memberName: users.name,
      memberCategory: professionalCategories.name,
    })
    .from(equipmentItems)
    .leftJoin(eventMembers, eq(eventMembers.id, equipmentItems.memberId))
    .leftJoin(users, eq(users.id, eventMembers.userId))
    .leftJoin(professionalCategories, eq(professionalCategories.id, eventMembers.categoryId))
    .where(eq(equipmentItems.eventId, eventId))
    .orderBy(asc(equipmentItems.sortOrder), asc(equipmentItems.createdAt));
  const providers = await executor
    .select({ memberId: eventMembers.id, name: users.name, category: professionalCategories.name })
    .from(eventMembers)
    .innerJoin(users, eq(users.id, eventMembers.userId))
    .leftJoin(professionalCategories, eq(professionalCategories.id, eventMembers.categoryId))
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.status, "active")));
  return { tool, items, providers: providers.filter((p) => p.memberId) };
}

export async function addEquipment(actor: Actor, eventId: string, input: z.infer<typeof equipmentSchema>, executor: DbExecutor = db) {
  const tool = await requireTradeToolAccess(actor, eventId, "equipment", executor);
  const memberId = tool.access.isOrganizer ? (input.memberId ?? null) : tool.access.memberId;
  await executor.insert(equipmentItems).values({ ...input, memberId, eventId });
}

export async function deleteEquipment(actor: Actor, eventId: string, itemId: string, executor: DbExecutor = db) {
  const tool = await requireTradeToolAccess(actor, eventId, "equipment", executor);
  const where = tool.access.isOrganizer
    ? and(eq(equipmentItems.id, itemId), eq(equipmentItems.eventId, eventId))
    : and(eq(equipmentItems.id, itemId), eq(equipmentItems.eventId, eventId), eq(equipmentItems.memberId, tool.access.memberId));
  const res = await executor.delete(equipmentItems).where(where).returning({ id: equipmentItems.id });
  if (!res.length) throw new NotFoundError();
}
