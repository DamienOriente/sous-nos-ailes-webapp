import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { imageBriefs, shotListItems } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireTradeToolAccess } from "./access";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => (v ? v : null));

export const imageBriefSchema = z.object({
  brief: optionalText(8000),
  usefulContacts: optionalText(2000),
});

export const shotSchema = z.object({
  kind: z.enum(["moment", "location"]).default("moment"),
  title: z.string().trim().min(1).max(200),
  startsAt: z.coerce.date().optional().nullable(),
  location: optionalText(200),
  notes: optionalText(1000),
  releaseConsentCollected: z.coerce.boolean().default(false),
});

export async function getImagesOverview(actor: Actor, eventId: string, executor: DbExecutor = db) {
  const tool = await requireTradeToolAccess(actor, eventId, "images", executor);
  const [brief] = await executor.select().from(imageBriefs).where(eq(imageBriefs.eventId, eventId)).limit(1);
  const items = await executor.select().from(shotListItems).where(eq(shotListItems.eventId, eventId)).orderBy(asc(shotListItems.kind), asc(shotListItems.startsAt), asc(shotListItems.sortOrder));
  return { tool, brief: brief ?? null, moments: items.filter((i) => i.kind === "moment"), locations: items.filter((i) => i.kind === "location") };
}

export async function upsertImageBrief(actor: Actor, eventId: string, input: z.infer<typeof imageBriefSchema>, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "images", executor);
  const values = { ...input, eventId, updatedByUserId: actor.userId };
  await executor.insert(imageBriefs).values(values).onConflictDoUpdate({ target: imageBriefs.eventId, set: values });
}

export async function addShot(actor: Actor, eventId: string, input: z.infer<typeof shotSchema>, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "images", executor);
  await executor.insert(shotListItems).values({ ...input, eventId });
}

export async function toggleShotConsent(actor: Actor, eventId: string, itemId: string, collected: boolean, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "images", executor);
  const res = await executor.update(shotListItems).set({ releaseConsentCollected: collected }).where(and(eq(shotListItems.id, itemId), eq(shotListItems.eventId, eventId))).returning({ id: shotListItems.id });
  if (!res.length) throw new NotFoundError();
}

export async function deleteShot(actor: Actor, eventId: string, itemId: string, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "images", executor);
  await executor.delete(shotListItems).where(and(eq(shotListItems.id, itemId), eq(shotListItems.eventId, eventId)));
}
