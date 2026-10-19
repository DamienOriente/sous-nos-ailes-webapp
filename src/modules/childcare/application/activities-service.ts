import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { childcareActivities } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";

export const activitySchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional().or(z.literal("")).transform((v) => (v ? v : null)),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional().nullable(),
    minAge: z.coerce.number().int().min(0).max(17).optional().nullable(),
    maxAge: z.coerce.number().int().min(0).max(17).optional().nullable(),
    location: z.string().trim().max(120).optional().or(z.literal("")).transform((v) => (v ? v : null)),
  })
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, { message: "La fin doit être après le début.", path: ["endsAt"] });
export type ActivityInput = z.infer<typeof activitySchema>;

/** The activity program is operational (no personal data): visible to anyone with the roster permission. */
export async function listActivities(actor: Actor, eventId: string, executor: DbExecutor = db) {
  await requireEventPermission(actor, eventId, "children.view_roster", executor);
  return executor.select().from(childcareActivities).where(eq(childcareActivities.eventId, eventId)).orderBy(asc(childcareActivities.startsAt));
}

export async function createActivity(actor: Actor, eventId: string, input: ActivityInput, executor: DbExecutor = db) {
  await requireEventPermission(actor, eventId, "children.manage", executor);
  await executor.insert(childcareActivities).values({ ...input, eventId });
}

export async function deleteActivity(actor: Actor, eventId: string, activityId: string, executor: DbExecutor = db) {
  await requireEventPermission(actor, eventId, "children.manage", executor);
  const res = await executor.delete(childcareActivities).where(and(eq(childcareActivities.id, activityId), eq(childcareActivities.eventId, eventId))).returning({ id: childcareActivities.id });
  if (!res.length) throw new NotFoundError();
}
