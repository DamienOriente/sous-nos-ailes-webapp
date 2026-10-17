import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { contactEventLinks, contacts, eventGuests, eventMembers, events, organizationMembers, organizations } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError, PaymentRequiredError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { getEffectivePlan, planFeatureLimit } from "@/modules/billing/application/entitlements";
import { serializeCsv } from "@/modules/contacts/domain/csv";
import {
  CONTACT_EXPORT_HEADERS,
  contactToCsvRow,
  findDuplicateGroups,
  mergeContacts as mergeContactFields,
  type ContactCategory,
  type ContactDraft,
} from "@/modules/contacts/domain/contact-import";
import { computeDedupeKey, normalizeEmail, normalizePhoneFr } from "@/modules/contacts/domain/normalize";
import { writeAudit } from "@/modules/guests/application/audit";

/**
 * Address book. Scope = the actor's personal contacts + the contacts of the
 * organisations they belong to. Writing in an organisation scope requires an
 * owner/admin/manager role. Nothing here is ever platform-wide.
 */
export type ContactScope = { kind: "personal" } | { kind: "organization"; organizationId: string };

export type OrganizationScopeInfo = { id: string; name: string; role: string; canWrite: boolean };

export type ContactRecord = typeof contacts.$inferSelect;

export type ContactInput = {
  firstName: string;
  lastName: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  category?: ContactCategory | null;
  tags?: string[];
  notes?: string | null;
};

const WRITE_ROLES = new Set(["owner", "admin", "manager"]);

export async function listOrganizationScopes(actor: Actor, executor: DbExecutor = db): Promise<OrganizationScopeInfo[]> {
  const rows = await executor
    .select({ id: organizations.id, name: organizations.name, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(and(eq(organizationMembers.userId, actor.userId), isNull(organizations.deletedAt)));
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, canWrite: WRITE_ROLES.has(r.role) }));
}

async function readableScopeFilter(actor: Actor, executor: DbExecutor): Promise<SQL> {
  const orgs = await listOrganizationScopes(actor, executor);
  const own = eq(contacts.ownerUserId, actor.userId);
  if (orgs.length === 0) return own;
  return or(own, inArray(contacts.organizationId, orgs.map((o) => o.id)))!;
}

async function assertScopeWritable(actor: Actor, scope: ContactScope, executor: DbExecutor): Promise<void> {
  if (scope.kind === "personal") return;
  const orgs = await listOrganizationScopes(actor, executor);
  const org = orgs.find((o) => o.id === scope.organizationId);
  if (!org) throw new NotFoundError();
  if (!org.canWrite) throw new ForbiddenError("Seuls les administrateurs de l'organisation peuvent modifier son carnet.");
}

function scopeColumns(actor: Actor, scope: ContactScope): { ownerUserId: string | null; organizationId: string | null } {
  return scope.kind === "personal" ? { ownerUserId: actor.userId, organizationId: null } : { ownerUserId: null, organizationId: scope.organizationId };
}

function scopeOf(row: Pick<ContactRecord, "ownerUserId" | "organizationId">): ContactScope {
  return row.organizationId ? { kind: "organization", organizationId: row.organizationId } : { kind: "personal" };
}

function normalizeInput(input: ContactInput): ContactDraft {
  const email = normalizeEmail(input.email);
  const phone = normalizePhoneFr(input.phone);
  if (input.email && !email) throw new ValidationError("Adresse e-mail invalide.");
  if (input.phone && !phone) throw new ValidationError("Numéro de téléphone non reconnu (format français ou international attendu).");
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const company = input.company?.trim() || null;
  if (!firstName && !lastName && !company) throw new ValidationError("Indiquez au moins un prénom, un nom ou une société.");
  return {
    firstName,
    lastName,
    company,
    email,
    phone,
    category: input.category ?? null,
    tags: Array.from(new Set((input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, 20),
    notes: input.notes?.trim() || null,
    dedupeKey: computeDedupeKey({ email, phone }),
  };
}

export type ContactUsage = { used: number; limit: number | null; remaining: number | null; planName: string; isPaid: boolean };

/** Personal scope counts against the organiser plan limit (`contacts`). Organisation books are not limited here. */
export async function getContactUsage(actor: Actor, executor: DbExecutor = db): Promise<ContactUsage> {
  const plan = await getEffectivePlan(actor.userId, "organizer", null, executor);
  const limit = planFeatureLimit(plan, "contacts");
  const [row] = await executor.select({ n: count() }).from(contacts).where(eq(contacts.ownerUserId, actor.userId));
  const used = row?.n ?? 0;
  return { used, limit, remaining: limit === null ? null : Math.max(0, limit - used), planName: plan.planName, isPaid: plan.isPaid };
}

async function assertWithinLimit(actor: Actor, scope: ContactScope, adding: number, executor: DbExecutor): Promise<void> {
  if (scope.kind !== "personal") return;
  const usage = await getContactUsage(actor, executor);
  if (usage.limit !== null && usage.used + adding > usage.limit) {
    throw new PaymentRequiredError(`Votre offre ${usage.planName} est limitée à ${usage.limit} contacts. Passez à Organisateur Plus pour un carnet illimité.`);
  }
}

export type ContactFilters = { q?: string; category?: string; tag?: string; scope?: "all" | "personal" | string; eventId?: string };

export type ContactListItem = ContactRecord & { eventCount: number };

export async function listContacts(actor: Actor, filters: ContactFilters = {}, executor: DbExecutor = db): Promise<ContactListItem[]> {
  const where: SQL[] = [await readableScopeFilter(actor, executor)];
  if (filters.scope === "personal") where.push(eq(contacts.ownerUserId, actor.userId));
  else if (filters.scope && filters.scope !== "all") where.push(eq(contacts.organizationId, filters.scope));
  if (filters.category) where.push(eq(contacts.category, filters.category));
  if (filters.tag) where.push(sql`${contacts.tags} @> ${JSON.stringify([filters.tag.toLowerCase()])}::jsonb`);
  if (filters.q) {
    const term = `%${filters.q.trim()}%`;
    where.push(or(ilike(contacts.firstName, term), ilike(contacts.lastName, term), ilike(contacts.company, term), ilike(contacts.email, term), ilike(contacts.phone, term))!);
  }
  if (filters.eventId) {
    where.push(sql`exists (select 1 from ${contactEventLinks} where ${contactEventLinks.contactId} = ${contacts.id} and ${contactEventLinks.eventId} = ${filters.eventId})`);
  }
  const rows = await executor
    .select({ contact: contacts, eventCount: sql<number>`(select count(*)::int from ${contactEventLinks} where ${contactEventLinks.contactId} = ${contacts.id})` })
    .from(contacts)
    .where(and(...where))
    .orderBy(asc(contacts.lastName), asc(contacts.firstName), desc(contacts.createdAt))
    .limit(2000);
  return rows.map((r) => ({ ...r.contact, eventCount: r.eventCount }));
}

export async function getContact(actor: Actor, contactId: string, executor: DbExecutor = db): Promise<ContactRecord> {
  const [row] = await executor
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), await readableScopeFilter(actor, executor)))
    .limit(1);
  if (!row) throw new NotFoundError();
  return row;
}

export async function listContactEvents(actor: Actor, contactId: string, executor: DbExecutor = db): Promise<Array<{ id: string; name: string; eventDate: string | null }>> {
  await getContact(actor, contactId, executor);
  return executor
    .select({ id: events.id, name: events.name, eventDate: events.eventDate })
    .from(contactEventLinks)
    .innerJoin(events, eq(events.id, contactEventLinks.eventId))
    .where(and(eq(contactEventLinks.contactId, contactId), isNull(events.deletedAt)))
    .orderBy(desc(events.eventDate));
}

export async function createContact(actor: Actor, input: ContactInput, scope: ContactScope = { kind: "personal" }, executor: DbExecutor = db): Promise<ContactRecord> {
  const draft = normalizeInput(input);
  await assertScopeWritable(actor, scope, executor);
  await assertWithinLimit(actor, scope, 1, executor);
  const [row] = await executor
    .insert(contacts)
    .values({ ...scopeColumns(actor, scope), ...draft })
    .returning();
  if (!row) throw new Error("insert failed");
  return row;
}

export async function updateContact(actor: Actor, contactId: string, input: ContactInput, executor: DbExecutor = db): Promise<ContactRecord> {
  const existing = await getContact(actor, contactId, executor);
  await assertScopeWritable(actor, scopeOf(existing), executor);
  const draft = normalizeInput(input);
  const [row] = await executor.update(contacts).set(draft).where(eq(contacts.id, contactId)).returning();
  if (!row) throw new NotFoundError();
  return row;
}

export async function deleteContact(actor: Actor, contactId: string, executor: DbExecutor = db): Promise<void> {
  const existing = await getContact(actor, contactId, executor);
  await assertScopeWritable(actor, scopeOf(existing), executor);
  await executor.delete(contacts).where(eq(contacts.id, contactId));
  await writeAudit(actor, { action: "contact.deleted", resourceType: "contact", resourceId: contactId, organizationId: existing.organizationId }, executor);
}

/** Linking a contact to an event requires guest management rights on that event (the link is event data too). */
export async function linkContactToEvent(actor: Actor, contactId: string, eventId: string, executor: DbExecutor = db): Promise<void> {
  await getContact(actor, contactId, executor);
  await requireEventPermission(actor, eventId, "event.guests.manage", executor);
  await executor.insert(contactEventLinks).values({ contactId, eventId }).onConflictDoNothing();
}

export async function unlinkContactFromEvent(actor: Actor, contactId: string, eventId: string, executor: DbExecutor = db): Promise<void> {
  await getContact(actor, contactId, executor);
  await requireEventPermission(actor, eventId, "event.guests.manage", executor);
  await executor.delete(contactEventLinks).where(and(eq(contactEventLinks.contactId, contactId), eq(contactEventLinks.eventId, eventId)));
}

export type ImportOutcome = { created: number; skippedDuplicates: number; limitReached: boolean; limit: number | null };

/**
 * Bulk import of already validated drafts. Duplicates (same dedupe key as an
 * existing contact in the target scope, or within the file) are skipped when
 * `skipDuplicates` is set. Stops silently at the plan limit and reports it.
 */
export async function importContacts(actor: Actor, drafts: ContactDraft[], scope: ContactScope, options: { skipDuplicates: boolean }, executor: DbExecutor = db): Promise<ImportOutcome> {
  await assertScopeWritable(actor, scope, executor);
  if (drafts.length > 2000) throw new ValidationError("Import limité à 2000 lignes.");
  const cols = scopeColumns(actor, scope);
  const scopeWhere = scope.kind === "personal" ? eq(contacts.ownerUserId, actor.userId) : eq(contacts.organizationId, scope.organizationId);
  const existingKeys = new Set(
    (await executor.select({ k: contacts.dedupeKey }).from(contacts).where(and(scopeWhere, sql`${contacts.dedupeKey} is not null`))).map((r) => r.k).filter((k): k is string => Boolean(k)),
  );
  let remaining: number | null = null;
  let limit: number | null = null;
  if (scope.kind === "personal") {
    const usage = await getContactUsage(actor, executor);
    remaining = usage.remaining;
    limit = usage.limit;
  }
  let created = 0;
  let skippedDuplicates = 0;
  let limitReached = false;
  const toInsert: Array<typeof contacts.$inferInsert> = [];
  for (const d of drafts) {
    if (options.skipDuplicates && d.dedupeKey && existingKeys.has(d.dedupeKey)) {
      skippedDuplicates += 1;
      continue;
    }
    if (remaining !== null && created >= remaining) {
      limitReached = true;
      break;
    }
    toInsert.push({ ...cols, firstName: d.firstName, lastName: d.lastName, company: d.company, email: d.email, phone: d.phone, category: d.category, tags: d.tags, notes: d.notes, dedupeKey: d.dedupeKey });
    if (d.dedupeKey) existingKeys.add(d.dedupeKey);
    created += 1;
  }
  for (let i = 0; i < toInsert.length; i += 200) {
    await executor.insert(contacts).values(toInsert.slice(i, i + 200));
  }
  await writeAudit(actor, { action: "contact.imported", resourceType: "contact", organizationId: cols.organizationId, metadata: { created, skippedDuplicates, limitReached } }, executor);
  return { created, skippedDuplicates, limitReached, limit };
}

/** CSV of the contacts the actor may read in the requested scope (never more). */
export async function exportContactsCsv(actor: Actor, scope: "all" | "personal" | string = "all", executor: DbExecutor = db): Promise<string> {
  const rows = await listContacts(actor, { scope }, executor);
  return serializeCsv([...CONTACT_EXPORT_HEADERS], rows.map((c) => contactToCsvRow(c)));
}

export async function findDuplicateContacts(actor: Actor, executor: DbExecutor = db) {
  const rows = await listContacts(actor, {}, executor);
  // Duplicates are only meaningful within one scope (personal vs each organisation).
  const byScope = new Map<string, ContactListItem[]>();
  for (const r of rows) {
    const key = r.organizationId ?? `user:${r.ownerUserId}`;
    byScope.set(key, [...(byScope.get(key) ?? []), r]);
  }
  return Array.from(byScope.values()).flatMap((list) => findDuplicateGroups(list));
}

/**
 * Assisted merge: the primary keeps its id, empty fields are filled from the
 * others, event links and guests re-pointed, duplicates removed. Transactional.
 */
export async function mergeContacts(actor: Actor, primaryId: string, otherIds: string[]): Promise<ContactRecord> {
  const others = Array.from(new Set(otherIds.filter((id) => id !== primaryId)));
  if (others.length === 0) throw new ValidationError("Sélectionnez au moins un doublon à fusionner.");
  return db.transaction(async (tx) => {
    const primary = await getContact(actor, primaryId, tx);
    await assertScopeWritable(actor, scopeOf(primary), tx);
    const otherRows: ContactRecord[] = [];
    for (const id of others) {
      const row = await getContact(actor, id, tx);
      if ((row.organizationId ?? null) !== (primary.organizationId ?? null) || (row.ownerUserId ?? null) !== (primary.ownerUserId ?? null)) {
        throw new ConflictError("Les contacts à fusionner doivent appartenir au même carnet.");
      }
      otherRows.push(row);
    }
    const merged = mergeContactFields(primary, otherRows);
    const [updated] = await tx
      .update(contacts)
      .set({ ...merged, dedupeKey: computeDedupeKey({ email: merged.email, phone: merged.phone }) })
      .where(eq(contacts.id, primaryId))
      .returning();
    const links = await tx.select().from(contactEventLinks).where(inArray(contactEventLinks.contactId, others));
    for (const l of links) await tx.insert(contactEventLinks).values({ contactId: primaryId, eventId: l.eventId }).onConflictDoNothing();
    await tx.update(eventGuests).set({ contactId: primaryId }).where(inArray(eventGuests.contactId, others));
    await tx.delete(contacts).where(inArray(contacts.id, others));
    await writeAudit(actor, { action: "contact.merged", resourceType: "contact", resourceId: primaryId, organizationId: primary.organizationId, metadata: { mergedIds: others } }, tx);
    if (!updated) throw new NotFoundError();
    return updated;
  });
}

/** Distinct tags across the readable scope, for filters/autocomplete. */
export async function listContactTags(actor: Actor, executor: DbExecutor = db): Promise<string[]> {
  const rows = await executor
    .select({ tag: sql<string>`distinct jsonb_array_elements_text(${contacts.tags})` })
    .from(contacts)
    .where(await readableScopeFilter(actor, executor));
  return rows.map((r) => r.tag).sort();
}

/** Events where the actor is an active organiser (targets for "associer à un évènement"). */
export async function listLinkableEvents(actor: Actor, executor: DbExecutor = db): Promise<Array<{ id: string; name: string; eventDate: string | null }>> {
  return executor
    .select({ id: events.id, name: events.name, eventDate: events.eventDate })
    .from(eventMembers)
    .innerJoin(events, eq(events.id, eventMembers.eventId))
    .where(and(eq(eventMembers.userId, actor.userId), eq(eventMembers.status, "active"), inArray(eventMembers.role, ["owner", "lead_organizer", "co_organizer", "wedding_planner"]), isNull(events.deletedAt)))
    .orderBy(desc(events.eventDate));
}
