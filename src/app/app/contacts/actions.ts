"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { CONTACT_CATEGORIES, type ContactDraft } from "@/modules/contacts/domain/contact-import";
import {
  createContact,
  deleteContact,
  importContacts,
  linkContactToEvent,
  mergeContacts,
  unlinkContactFromEvent,
  updateContact,
  type ContactScope,
} from "@/modules/contacts/application/contact-service";

const scopeSchema = z.union([z.literal("personal"), z.string().uuid()]);

function toScope(v: string): ContactScope {
  return v === "personal" ? { kind: "personal" } : { kind: "organization", organizationId: v };
}

const contactSchema = z.object({
  firstName: z.string().trim().max(80).default(""),
  lastName: z.string().trim().max(80).default(""),
  company: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  category: z.enum(CONTACT_CATEGORIES).optional().nullable(),
  tags: z.string().trim().max(400).optional().default(""),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type ContactFormValues = z.input<typeof contactSchema>;

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] = [...(out[key] ?? []), issue.message];
  }
  return out;
}

function parseContact(input: unknown) {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: new ValidationError(), fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  return {
    ok: true as const,
    value: {
      firstName: v.firstName,
      lastName: v.lastName,
      company: v.company ?? null,
      email: v.email || null,
      phone: v.phone || null,
      category: v.category ?? null,
      tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: v.notes ?? null,
    },
  };
}

export async function createContactAction(input: ContactFormValues & { scope: string }): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const scope = scopeSchema.safeParse(input.scope);
    if (!scope.success) throw new ValidationError("Portée invalide.");
    const parsed = parseContact(input);
    if (!parsed.ok) return { ok: false, error: parsed.error.message, code: "validation", fieldErrors: parsed.fieldErrors };
    const row = await createContact(actor, parsed.value, toScope(scope.data));
    revalidatePath("/app/contacts");
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateContactAction(contactId: string, input: ContactFormValues): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const id = z.string().uuid().parse(contactId);
    const parsed = parseContact(input);
    if (!parsed.ok) return { ok: false, error: parsed.error.message, code: "validation", fieldErrors: parsed.fieldErrors };
    const row = await updateContact(actor, id, parsed.value);
    revalidatePath("/app/contacts");
    revalidatePath(`/app/contacts/${id}`);
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteContactAction(contactId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteContact(actor, z.string().uuid().parse(contactId));
    revalidatePath("/app/contacts");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function linkContactEventAction(contactId: string, eventId: string, link: boolean): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const c = z.string().uuid().parse(contactId);
    const e = z.string().uuid().parse(eventId);
    if (link) await linkContactToEvent(actor, c, e);
    else await unlinkContactFromEvent(actor, c, e);
    revalidatePath(`/app/contacts/${c}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

const draftSchema = z.object({
  firstName: z.string().max(80),
  lastName: z.string().max(80),
  company: z.string().max(120).nullable(),
  email: z.string().max(200).nullable(),
  phone: z.string().max(40).nullable(),
  category: z.enum(CONTACT_CATEGORIES).nullable(),
  tags: z.array(z.string().max(40)).max(20),
  notes: z.string().max(2000).nullable(),
  dedupeKey: z.string().max(220).nullable(),
});

export async function importContactsAction(input: { drafts: ContactDraft[]; scope: string; skipDuplicates: boolean }): Promise<ActionResult<{ created: number; skippedDuplicates: number; limitReached: boolean; limit: number | null }>> {
  try {
    const actor = await requireActorOrThrow();
    const scope = scopeSchema.safeParse(input.scope);
    if (!scope.success) throw new ValidationError("Portée invalide.");
    const drafts = z.array(draftSchema).max(2000).safeParse(input.drafts);
    if (!drafts.success) throw new ValidationError("Fichier d'import invalide.");
    const result = await importContacts(actor, drafts.data, toScope(scope.data), { skipDuplicates: Boolean(input.skipDuplicates) });
    revalidatePath("/app/contacts");
    return { ok: true, data: result };
  } catch (e) {
    return toActionError(e);
  }
}

export async function mergeContactsAction(primaryId: string, otherIds: string[]): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const primary = z.string().uuid().parse(primaryId);
    const others = z.array(z.string().uuid()).min(1).max(20).parse(otherIds);
    const row = await mergeContacts(actor, primary, others);
    revalidatePath("/app/contacts");
    revalidatePath("/app/contacts/doublons");
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return toActionError(e);
  }
}
