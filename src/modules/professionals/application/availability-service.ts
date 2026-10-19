import { asc, eq } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { professionalAvailability } from "@/db/schema";
import type { Actor } from "@/lib/session";
import { requireProfessionalManage } from "@/modules/authorization";
import { availabilityGridSchema } from "@/modules/professionals/domain/listing-schema";
import { ValidationError } from "@/lib/errors";
import { recomputeDerived } from "./professional-service";

export type AvailabilitySlot = { weekday: number; startMinute: number; endMinute: number };

export async function listAvailability(actor: Actor, professionalId: string, executor: DbExecutor = db): Promise<AvailabilitySlot[]> {
  await requireProfessionalManage(actor, professionalId, executor);
  return executor
    .select({ weekday: professionalAvailability.weekday, startMinute: professionalAvailability.startMinute, endMinute: professionalAvailability.endMinute })
    .from(professionalAvailability)
    .where(eq(professionalAvailability.professionalId, professionalId))
    .orderBy(asc(professionalAvailability.weekday), asc(professionalAvailability.startMinute));
}

/** Replaces the whole weekly grid (idempotent, small table). */
export async function replaceAvailability(actor: Actor, professionalId: string, slots: unknown): Promise<void> {
  const parsed = availabilityGridSchema.safeParse(slots);
  if (!parsed.success) throw new ValidationError("Créneaux invalides.");
  await db.transaction(async (tx) => {
    await requireProfessionalManage(actor, professionalId, tx);
    await tx.delete(professionalAvailability).where(eq(professionalAvailability.professionalId, professionalId));
    const unique = new Map<string, AvailabilitySlot>();
    for (const s of parsed.data) unique.set(`${s.weekday}-${s.startMinute}-${s.endMinute}`, s);
    if (unique.size) await tx.insert(professionalAvailability).values([...unique.values()].map((s) => ({ professionalId, ...s })));
    await recomputeDerived(professionalId, tx);
  });
}
