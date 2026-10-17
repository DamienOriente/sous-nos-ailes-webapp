import { and, asc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { contactEventLinks, eventGuests, guestGroups, seatingAssignments, seatingTables } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { serializeCsv } from "@/modules/contacts/domain/csv";
import { normalizeEmail, normalizePhoneFr } from "@/modules/contacts/domain/normalize";
import { getContact, listContacts } from "@/modules/contacts/application/contact-service";
import { writeAudit } from "@/modules/guests/application/audit";
import { computeRsvpStats, GUEST_EXPORT_HEADERS, guestToCsvRow, type GuestDraft, type RsvpStats, type RsvpStatus } from "@/modules/guests/domain/guests";

export type GuestRecord = typeof eventGuests.$inferSelect;
export type GuestGroupRecord = typeof guestGroups.$inferSelect;

export type GuestListItem = GuestRecord & { groupName: string | null; tableName: string | null };

export type GuestInput = {
  firstName: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  groupId?: string | null;
  isChild?: boolean;
  ageYears?: number | null;
  dietaryPreference?: string | null;
  plusOnesAllowed?: number;
  notes?: string | null;
  rsvpStatus?: RsvpStatus;
};

export type GuestFilters = { q?: string; groupId?: string; rsvp?: RsvpStatus; children?: boolean };

// ── Groups ──────────────────────────────────────────────────────────────────
export async function listGroups(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<Array<GuestGroupRecord & { guestCount: number }>> {
  await requireEventPermission(actor, eventId, "event.guests.view", executor);
  const rows = await executor
    .select({ group: guestGroups, guestCount: sql<number>`(select count(*)::int from ${eventGuests} where ${eventGuests.groupId} = ${guestGroups.id})` })
    .from(guestGroups)
    .where(eq(guestGroups.eventId, eventId))
    .orderBy(asc(guestGroups.name));
  return rows.map((r) => ({ ...r.group, guestCount: r.guestCount }));
}

export async function createGroup(actor: Actor, eventId: string, input: { name: string; side?: string | null }, executor: DbExecutor = db): Promise<GuestGroupRecord> {
  await requireEventPermission(actor, eventId, "event.guests.manage", executor);
  const name = input.name.trim();
  if (!name) throw new ValidationError("Le nom du groupe est requis.");
  const [row] = await executor.insert(guestGroups).values({ eventId, name, side: input.side?.trim() || null }).returning();
  if (!row) throw new Error("insert failed");
  return row;
}

export async function updateGroup(actor: Actor, eventId: string, groupId: string, input: { name: string; side?: string | null }, executor: DbExecutor = db): Promise<GuestGroupRecord> {
  await requireEventPermission(actor, eventId, "event.guests.manage", executor);
  const name = input.name.trim();
  if (!name) throw new ValidationError("Le nom du groupe est requis.");
  const [row] = await executor
    .update(guestGroups)
    .set({ name, side: input.side?.trim() || null })
    .where(and(eq(guestGroups.id, groupId), eq(guestGroups.eventId, eventId)))
    .returning();
  if (!row) throw new NotFoundError();
  return row;
}

export async function deleteGroup(actor: Actor, eventId: string, groupId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.guests.manage", executor);
  const deleted = await executor.delete(guestGroups).where(and(eq(guestGroups.id, groupId), eq(guestGroups.eventId, eventId))).returning({ id: guestGroups.id });
  if (deleted.length === 0) throw new NotFoundError();
  await writeAudit(actor, { action: "guest_group.deleted", resourceType: "guest_group", resourceId: groupId, eventId }, executor);
}

async function ensureGroupByName(eventId: string, name: string, cache: Map<string, string>, executor: DbExecutor): Promise<string> {
  const key = name.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const [existing] = await executor
    .select({ id: guestGroups.id })
    .from(guestGroups)
    .where(and(eq(guestGroups.eventId, eventId), sql`lower(${guestGroups.name}) = ${key}`))
    .limit(1);
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }
  const [row] = await executor.insert(guestGroups).values({ eventId, name: name.trim() }).returning({ id: guestGroups.id });
  cache.set(key, row!.id);
  return row!.id;
}

// ── Guests ──────────────────────────────────────────────────────────────────
function normalizeGuest(input: GuestInput) {
  const firstName = input.firstName.trim();
  if (!firstName) throw new ValidationError("Le prénom est requis.");
  const email = normalizeEmail(input.email);
  const phone = normalizePhoneFr(input.phone);
  if (input.email && !email) throw new ValidationError("Adresse e-mail invalide.");
  if (input.phone && !phone) throw new ValidationError("Numéro de téléphone non reconnu.");
  const isChild = Boolean(input.isChild);
  const age = input.ageYears ?? null;
  if (isChild && age !== null && (age < 0 || age > 17)) throw new ValidationError("L'âge d'un enfant doit être compris entre 0 et 17 ans.");
  const plus = input.plusOnesAllowed ?? 0;
  if (plus < 0 || plus > 10) throw new ValidationError("Accompagnants autorisés : entre 0 et 10.");
  return {
    firstName,
    lastName: (input.lastName ?? "").trim(),
    email,
    phone,
    groupId: input.groupId || null,
    isChild,
    ageYears: isChild ? age : null,
    // Dietary label only — the field is never used for medical information.
    dietaryPreference: input.dietaryPreference?.trim().slice(0, 80) || null,
    plusOnesAllowed: plus,
    notes: input.notes?.trim() || null,
  };
}

async function assertGroupInEvent(eventId: string, groupId: string | null, executor: DbExecutor): Promise<void> {
  if (!groupId) return;
  const [g] = await executor.select({ id: guestGroups.id }).from(guestGroups).where(and(eq(guestGroups.id, groupId), eq(guestGroups.eventId, eventId))).limit(1);
  if (!g) throw new ValidationError("Groupe inconnu pour cet évènement.");
}

export async function listGuests(actor: Actor, eventId: string, filters: GuestFilters = {}, executor: DbExecutor = db): Promise<GuestListItem[]> {
  await requireEventPermission(actor, eventId, "event.guests.view", executor);
  const where: SQL[] = [eq(eventGuests.eventId, eventId)];
  if (filters.groupId) where.push(eq(eventGuests.groupId, filters.groupId));
  if (filters.rsvp) where.push(eq(eventGuests.rsvpStatus, filters.rsvp));
  if (filters.children) where.push(eq(eventGuests.isChild, true));
  if (filters.q) {
    const term = `%${filters.q.trim()}%`;
    where.push(or(ilike(eventGuests.firstName, term), ilike(eventGuests.lastName, term), ilike(eventGuests.email, term))!);
  }
  const rows = await executor
    .select({ guest: eventGuests, groupName: guestGroups.name, tableName: seatingTables.name })
    .from(eventGuests)
    .leftJoin(guestGroups, eq(guestGroups.id, eventGuests.groupId))
    .leftJoin(seatingAssignments, eq(seatingAssignments.guestId, eventGuests.id))
    .leftJoin(seatingTables, eq(seatingTables.id, seatingAssignments.tableId))
    .where(and(...where))
    .orderBy(asc(eventGuests.lastName), asc(eventGuests.firstName));
  return rows.map((r) => ({ ...r.guest, groupName: r.groupName, tableName: r.tableName }));
}

export async function getGuest(actor: Actor, eventId: string, guestId: string, executor: DbExecutor = db): Promise<GuestRecord> {
  await requireEventPermission(actor, eventId, "event.guests.view", executor);
  const [row] = await executor.select().from(eventGuests).where(and(eq(eventGuests.id, guestId), eq(eventGuests.eventId, eventId))).limit(1);
  if (!row) throw new NotFoundError();
  return row;
}

export async function createGuest(actor: Actor, eventId: string, input: GuestInput, executor: DbExecutor = db): Promise<GuestRecord> {
  await requireEventPermission(actor, eventId, "event.guests.manage", executor);
  const values = normalizeGuest(input);
  await assertGroupInEvent(eventId, values.groupId, executor);
  const [row] = await executor.insert(eventGuests).values({ eventId, ...values, rsvpStatus: input.rsvpStatus ?? "pending" }).returning();
  if (!row) throw new Error("insert failed");
  return row;
}

export async function updateGuest(actor: Actor, eventId: string, guestId: string, input: GuestInput, executor: DbExecutor = db): Promise<GuestRecord> {
  await requireEventPermission(actor, eventId, "event.guests.manage", executor);
  const values = normalizeGuest(input);
  await assertGroupInEvent(eventId, values.groupId, executor);
  const patch: Partial<typeof eventGuests.$inferInsert> = { ...values };
  if (input.rsvpStatus) {
    patch.rsvpStatus = input.rsvpStatus;
    patch.rsvpAnsweredAt = input.rsvpStatus === "pending" ? null : new Date();
  }
  const [row] = await executor.update(eventGuests).set(patch).where(and(eq(eventGuests.id, guestId), eq(eventGuests.eventId, eventId))).returning();
  if (!row) throw new NotFoundError();
  return row;
}

export async function deleteGuest(actor: Actor, eventId: string, guestId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.guests.manage", executor);
  const deleted = await executor.delete(eventGuests).where(and(eq(eventGuests.id, guestId), eq(eventGuests.eventId, eventId))).returning({ id: eventGuests.id });
  if (deleted.length === 0) throw new NotFoundError();
  await writeAudit(actor, { action: "guest.deleted", resourceType: "event_guest", resourceId: guestId, eventId }, executor);
}

/** Adds guests from the actor's address book (contacts they can read) and links those contacts to the event. */
export async function addGuestsFromContacts(actor: Actor, eventId: string, contactIds: string[], groupId: string | null = null): Promise<{ created: number; skipped: number }> {
  return db.transaction(async (tx) => {
    await requireEventPermission(actor, eventId, "event.guests.manage", tx);
    await assertGroupInEvent(eventId, groupId, tx);
    const ids = Array.from(new Set(contactIds));
    if (ids.length === 0) throw new ValidationError("Sélectionnez au moins un contact.");
    const existing = await tx.select({ contactId: eventGuests.contactId }).from(eventGuests).where(and(eq(eventGuests.eventId, eventId), inArray(eventGuests.contactId, ids)));
    const already = new Set(existing.map((e) => e.contactId));
    let created = 0;
    let skipped = 0;
    for (const id of ids) {
      const c = await getContact(actor, id, tx);
      if (already.has(c.id)) {
        skipped += 1;
        continue;
      }
      await tx.insert(eventGuests).values({ eventId, groupId, firstName: c.firstName || c.company || "Invité", lastName: c.lastName, email: c.email, phone: c.phone, contactId: c.id });
      await tx.insert(contactEventLinks).values({ contactId: c.id, eventId }).onConflictDoNothing();
      created += 1;
    }
    return { created, skipped };
  });
}

export async function importGuests(actor: Actor, eventId: string, drafts: GuestDraft[]): Promise<{ created: number; groupsCreated: number }> {
  if (drafts.length > 2000) throw new ValidationError("Import limité à 2000 lignes.");
  return db.transaction(async (tx) => {
    await requireEventPermission(actor, eventId, "event.guests.manage", tx);
    const cache = new Map<string, string>();
    const existingGroups = await tx.select({ id: guestGroups.id, name: guestGroups.name }).from(guestGroups).where(eq(guestGroups.eventId, eventId));
    for (const g of existingGroups) cache.set(g.name.toLowerCase(), g.id);
    const knownBefore = cache.size;
    const values: Array<typeof eventGuests.$inferInsert> = [];
    for (const d of drafts) {
      const groupId = d.groupName ? await ensureGroupByName(eventId, d.groupName, cache, tx) : null;
      values.push({ eventId, groupId, firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone, isChild: d.isChild, ageYears: d.ageYears, dietaryPreference: d.dietaryPreference, plusOnesAllowed: d.plusOnesAllowed, notes: d.notes });
    }
    for (let i = 0; i < values.length; i += 200) await tx.insert(eventGuests).values(values.slice(i, i + 200));
    await writeAudit(actor, { action: "guest.imported", resourceType: "event_guest", eventId, metadata: { created: values.length } }, tx);
    return { created: values.length, groupsCreated: cache.size - knownBefore };
  });
}

export async function getGuestStats(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<RsvpStats> {
  await requireEventPermission(actor, eventId, "event.guests.view", executor);
  const rows = await executor
    .select({ isChild: eventGuests.isChild, rsvpStatus: eventGuests.rsvpStatus, rsvpGuestsCount: eventGuests.rsvpGuestsCount, plusOnesAllowed: eventGuests.plusOnesAllowed })
    .from(eventGuests)
    .where(eq(eventGuests.eventId, eventId));
  return computeRsvpStats(rows);
}

export async function exportGuestsCsv(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<string> {
  const rows = await listGuests(actor, eventId, {}, executor);
  return serializeCsv([...GUEST_EXPORT_HEADERS], rows.map((g) => guestToCsvRow(g)));
}

/** Contacts of the actor not yet added as guests of this event (for the picker). */
export async function listAddableContacts(actor: Actor, eventId: string, q?: string, executor: DbExecutor = db) {
  await requireEventPermission(actor, eventId, "event.guests.manage", executor);
  const all = await listContacts(actor, { q }, executor);
  const used = new Set((await executor.select({ contactId: eventGuests.contactId }).from(eventGuests).where(eq(eventGuests.eventId, eventId))).map((r) => r.contactId));
  return all.filter((c) => !used.has(c.id)).map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, company: c.company, email: c.email, category: c.category }));
}
