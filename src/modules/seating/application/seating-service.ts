import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { eventGuests, events, guestGroups, seatingAssignments, seatingTables } from "@/db/schema";
import { ConflictError, NotFoundError, PaymentRequiredError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { getEffectivePlan, planHasFeature } from "@/modules/billing/application/entitlements";
import { writeAudit } from "@/modules/guests/application/audit";
import { CANVAS, seatOccupancy, settlePosition, TABLE_SHAPES, type Occupancy, type TableShape } from "@/modules/seating/domain/geometry";

export type SeatingTableRecord = typeof seatingTables.$inferSelect;
export type SeatingAssignmentRecord = typeof seatingAssignments.$inferSelect;

export type SeatingGuest = { id: string; firstName: string; lastName: string; isChild: boolean; rsvpStatus: string; groupName: string | null };
export type SeatingTableView = SeatingTableRecord & { occupancy: Occupancy; guests: SeatingGuest[] };
export type SeatingPlan = { eventId: string; eventName: string; tables: SeatingTableView[]; unplaced: SeatingGuest[]; totalGuests: number; totalSeats: number };

export type TableInput = { name: string; shape: TableShape; capacity: number; x?: number; y?: number; rotation?: number };

/** Seating plan is premium: gated by the event owner's organizer plan. */
export async function assertSeatingEntitlement(eventId: string, executor: DbExecutor = db): Promise<void> {
  const [e] = await executor.select({ ownerUserId: events.ownerUserId }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!e) throw new NotFoundError();
  const plan = await getEffectivePlan(e.ownerUserId, "organizer", null, executor);
  if (!planHasFeature(plan, "seating_plan")) throw new PaymentRequiredError("Le plan de table fait partie de l'offre Organisateur Plus.");
}

export async function getSeatingPlan(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<SeatingPlan> {
  await requireEventPermission(actor, eventId, "event.seating.view", executor);
  const [event] = await executor.select({ name: events.name }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new NotFoundError();
  const tables = await executor.select().from(seatingTables).where(eq(seatingTables.eventId, eventId)).orderBy(asc(seatingTables.sortOrder), asc(seatingTables.createdAt));
  const guests = await executor
    .select({ id: eventGuests.id, firstName: eventGuests.firstName, lastName: eventGuests.lastName, isChild: eventGuests.isChild, rsvpStatus: eventGuests.rsvpStatus, groupName: guestGroups.name, tableId: seatingAssignments.tableId })
    .from(eventGuests)
    .leftJoin(guestGroups, eq(guestGroups.id, eventGuests.groupId))
    .leftJoin(seatingAssignments, eq(seatingAssignments.guestId, eventGuests.id))
    .where(eq(eventGuests.eventId, eventId))
    .orderBy(asc(eventGuests.lastName), asc(eventGuests.firstName));
  const byTable = new Map<string, SeatingGuest[]>();
  const unplaced: SeatingGuest[] = [];
  for (const g of guests) {
    const { tableId, ...guest } = g;
    if (tableId) byTable.set(tableId, [...(byTable.get(tableId) ?? []), guest]);
    else unplaced.push(guest);
  }
  const views: SeatingTableView[] = tables.map((t) => {
    const list = byTable.get(t.id) ?? [];
    return { ...t, guests: list, occupancy: seatOccupancy(t.capacity, list.length) };
  });
  return { eventId, eventName: event.name, tables: views, unplaced, totalGuests: guests.length, totalSeats: tables.reduce((n, t) => n + t.capacity, 0) };
}

function validateTable(input: TableInput) {
  const name = input.name.trim();
  if (!name) throw new ValidationError("Le nom de la table est requis.");
  if (!TABLE_SHAPES.includes(input.shape)) throw new ValidationError("Forme inconnue.");
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 40) throw new ValidationError("Capacité : entre 1 et 40 places.");
  const rotation = ((input.rotation ?? 0) % 360 + 360) % 360;
  return { name: name.slice(0, 60), shape: input.shape, capacity: input.capacity, rotation };
}

export async function createTable(actor: Actor, eventId: string, input: TableInput, executor: DbExecutor = db): Promise<SeatingTableRecord> {
  await requireEventPermission(actor, eventId, "event.seating.manage", executor);
  await assertSeatingEntitlement(eventId, executor);
  const v = validateTable(input);
  const [{ n } = { n: 0 }] = await executor.select({ n: sql<number>`count(*)::int` }).from(seatingTables).where(eq(seatingTables.eventId, eventId));
  // New tables land on a grid so they never stack on top of each other.
  const fallback = { x: 120 + (n % 6) * 150, y: 120 + Math.floor(n / 6) * 160 };
  const pos = settlePosition({ x: input.x ?? fallback.x, y: input.y ?? fallback.y }, v.shape, v.capacity);
  const [row] = await executor.insert(seatingTables).values({ eventId, ...v, x: pos.x, y: pos.y, sortOrder: n }).returning();
  if (!row) throw new Error("insert failed");
  return row;
}

export async function updateTable(actor: Actor, eventId: string, tableId: string, input: TableInput, executor: DbExecutor = db): Promise<SeatingTableRecord> {
  await requireEventPermission(actor, eventId, "event.seating.manage", executor);
  await assertSeatingEntitlement(eventId, executor);
  const v = validateTable(input);
  const [existing] = await executor.select().from(seatingTables).where(and(eq(seatingTables.id, tableId), eq(seatingTables.eventId, eventId))).limit(1);
  if (!existing) throw new NotFoundError();
  const pos = settlePosition({ x: input.x ?? existing.x, y: input.y ?? existing.y }, v.shape, v.capacity);
  const [row] = await executor.update(seatingTables).set({ ...v, x: pos.x, y: pos.y }).where(eq(seatingTables.id, tableId)).returning();
  return row!;
}

export async function moveTable(actor: Actor, eventId: string, tableId: string, position: { x: number; y: number }, executor: DbExecutor = db): Promise<{ x: number; y: number }> {
  await requireEventPermission(actor, eventId, "event.seating.manage", executor);
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new ValidationError("Position invalide.");
  const [existing] = await executor.select().from(seatingTables).where(and(eq(seatingTables.id, tableId), eq(seatingTables.eventId, eventId))).limit(1);
  if (!existing) throw new NotFoundError();
  const pos = settlePosition({ x: Math.min(CANVAS.width, Math.max(0, position.x)), y: Math.min(CANVAS.height, Math.max(0, position.y)) }, existing.shape, existing.capacity);
  await executor.update(seatingTables).set({ x: pos.x, y: pos.y }).where(eq(seatingTables.id, tableId));
  return pos;
}

export async function deleteTable(actor: Actor, eventId: string, tableId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.seating.manage", executor);
  const deleted = await executor.delete(seatingTables).where(and(eq(seatingTables.id, tableId), eq(seatingTables.eventId, eventId))).returning({ id: seatingTables.id });
  if (deleted.length === 0) throw new NotFoundError();
  await writeAudit(actor, { action: "seating_table.deleted", resourceType: "seating_table", resourceId: tableId, eventId }, executor);
}

async function assertTableAndGuest(eventId: string, tableId: string, guestId: string, executor: DbExecutor) {
  const [t] = await executor.select({ id: seatingTables.id, capacity: seatingTables.capacity, name: seatingTables.name }).from(seatingTables).where(and(eq(seatingTables.id, tableId), eq(seatingTables.eventId, eventId))).limit(1);
  if (!t) throw new NotFoundError();
  const [g] = await executor.select({ id: eventGuests.id }).from(eventGuests).where(and(eq(eventGuests.id, guestId), eq(eventGuests.eventId, eventId))).limit(1);
  if (!g) throw new NotFoundError();
  return t;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && ((err as { code?: string }).code === "23505" || (err as { cause?: { code?: string } }).cause?.code === "23505");
}

/**
 * Seats a guest. Over-capacity is allowed (the UI shows it in red) but a guest
 * can only sit at one table: the unique constraint turns into a ConflictError.
 */
export async function assignGuest(actor: Actor, eventId: string, guestId: string, tableId: string, executor: DbExecutor = db): Promise<{ occupancy: Occupancy }> {
  await requireEventPermission(actor, eventId, "event.seating.manage", executor);
  await assertSeatingEntitlement(eventId, executor);
  const table = await assertTableAndGuest(eventId, tableId, guestId, executor);
  try {
    await executor.insert(seatingAssignments).values({ eventId, tableId, guestId });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError("Cet invité est déjà placé à une table. Déplacez-le plutôt.");
    throw err;
  }
  const [{ n } = { n: 0 }] = await executor.select({ n: sql<number>`count(*)::int` }).from(seatingAssignments).where(eq(seatingAssignments.tableId, tableId));
  return { occupancy: seatOccupancy(table.capacity, n) };
}

/** Moves a guest to another table (or seats them if not yet placed). */
export async function moveGuest(actor: Actor, eventId: string, guestId: string, tableId: string, executor: DbExecutor = db): Promise<{ occupancy: Occupancy }> {
  await requireEventPermission(actor, eventId, "event.seating.manage", executor);
  await assertSeatingEntitlement(eventId, executor);
  const table = await assertTableAndGuest(eventId, tableId, guestId, executor);
  await executor
    .insert(seatingAssignments)
    .values({ eventId, tableId, guestId })
    .onConflictDoUpdate({ target: seatingAssignments.guestId, set: { tableId, seatNumber: null } });
  const [{ n } = { n: 0 }] = await executor.select({ n: sql<number>`count(*)::int` }).from(seatingAssignments).where(eq(seatingAssignments.tableId, tableId));
  return { occupancy: seatOccupancy(table.capacity, n) };
}

export async function unassignGuest(actor: Actor, eventId: string, guestId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.seating.manage", executor);
  await executor.delete(seatingAssignments).where(and(eq(seatingAssignments.eventId, eventId), eq(seatingAssignments.guestId, guestId)));
}

export async function unassignAllFromTable(actor: Actor, eventId: string, tableId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.seating.manage", executor);
  await executor.delete(seatingAssignments).where(and(eq(seatingAssignments.eventId, eventId), eq(seatingAssignments.tableId, tableId)));
}

export async function reorderTables(actor: Actor, eventId: string, orderedIds: string[], executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.seating.manage", executor);
  const rows = await executor.select({ id: seatingTables.id }).from(seatingTables).where(and(eq(seatingTables.eventId, eventId), inArray(seatingTables.id, orderedIds)));
  const known = new Set(rows.map((r) => r.id));
  let i = 0;
  for (const id of orderedIds) {
    if (!known.has(id)) continue;
    await executor.update(seatingTables).set({ sortOrder: i }).where(eq(seatingTables.id, id));
    i += 1;
  }
}
