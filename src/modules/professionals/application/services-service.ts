import { and, asc, eq, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { professionalServices } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireProfessionalManage } from "@/modules/authorization";
import type { ServiceInput } from "@/modules/professionals/domain/listing-schema";
import { recomputeDerived } from "./professional-service";

export type ServiceRow = typeof professionalServices.$inferSelect;

export async function listServices(actor: Actor, professionalId: string, executor: DbExecutor = db): Promise<ServiceRow[]> {
  await requireProfessionalManage(actor, professionalId, executor);
  return executor.select().from(professionalServices).where(eq(professionalServices.professionalId, professionalId)).orderBy(asc(professionalServices.sortOrder), asc(professionalServices.createdAt));
}

function values(input: ServiceInput) {
  if (input.minAge != null && input.maxAge != null && input.maxAge < input.minAge) throw new ValidationError("L'âge maximal doit être supérieur à l'âge minimal.");
  return {
    name: input.name,
    description: input.description || null,
    priceCents: input.priceCents ?? null,
    priceUnit: input.priceUnit || null,
    durationMinutes: input.durationMinutes ?? null,
    minAge: input.minAge ?? null,
    maxAge: input.maxAge ?? null,
    capacity: input.capacity ?? null,
    isActive: input.isActive,
  };
}

export async function createService(actor: Actor, professionalId: string, input: ServiceInput, executor: DbExecutor = db): Promise<{ id: string }> {
  await requireProfessionalManage(actor, professionalId, executor);
  const [max] = await executor.select({ m: sql<number>`coalesce(max(sort_order), -1)::int` }).from(professionalServices).where(eq(professionalServices.professionalId, professionalId));
  const [row] = await executor
    .insert(professionalServices)
    .values({ professionalId, sortOrder: (max?.m ?? -1) + 1, ...values(input) })
    .returning({ id: professionalServices.id });
  if (!row) throw new Error("insert failed");
  await recomputeDerived(professionalId, executor);
  return { id: row.id };
}

export async function updateService(actor: Actor, professionalId: string, serviceId: string, input: ServiceInput, executor: DbExecutor = db): Promise<void> {
  await requireProfessionalManage(actor, professionalId, executor);
  const res = await executor
    .update(professionalServices)
    .set(values(input))
    .where(and(eq(professionalServices.id, serviceId), eq(professionalServices.professionalId, professionalId)))
    .returning({ id: professionalServices.id });
  if (!res.length) throw new NotFoundError();
  await recomputeDerived(professionalId, executor);
}

export async function deleteService(actor: Actor, professionalId: string, serviceId: string, executor: DbExecutor = db): Promise<void> {
  await requireProfessionalManage(actor, professionalId, executor);
  const res = await executor.delete(professionalServices).where(and(eq(professionalServices.id, serviceId), eq(professionalServices.professionalId, professionalId))).returning({ id: professionalServices.id });
  if (!res.length) throw new NotFoundError();
  await recomputeDerived(professionalId, executor);
}

/** Moves a service one position up or down (swaps sort orders). */
export async function moveService(actor: Actor, professionalId: string, serviceId: string, direction: "up" | "down", executor: DbExecutor = db): Promise<void> {
  await requireProfessionalManage(actor, professionalId, executor);
  const rows = await executor.select({ id: professionalServices.id }).from(professionalServices).where(eq(professionalServices.professionalId, professionalId)).orderBy(asc(professionalServices.sortOrder), asc(professionalServices.createdAt));
  const idx = rows.findIndex((r) => r.id === serviceId);
  if (idx === -1) throw new NotFoundError();
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= rows.length) return;
  const reordered = [...rows];
  const current = reordered[idx]!;
  reordered[idx] = reordered[target]!;
  reordered[target] = current;
  for (let i = 0; i < reordered.length; i += 1) {
    await executor.update(professionalServices).set({ sortOrder: i }).where(eq(professionalServices.id, reordered[i]!.id));
  }
}
