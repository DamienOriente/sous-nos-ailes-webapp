"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { RSVP_STATUSES, type GuestDraft } from "@/modules/guests/domain/guests";
import {
  addGuestsFromContacts,
  createGroup,
  createGuest,
  deleteGroup,
  deleteGuest,
  importGuests,
  updateGroup,
  updateGuest,
} from "@/modules/guests/application/guest-service";

const uuid = z.string().uuid();

const guestSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis.").max(80),
  lastName: z.string().trim().max(80).default(""),
  email: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  groupId: z.string().trim().optional().nullable(),
  isChild: z.boolean().default(false),
  ageYears: z.number().int().min(0).max(17).optional().nullable(),
  dietaryPreference: z.string().trim().max(80).optional().nullable(),
  plusOnesAllowed: z.number().int().min(0).max(10).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
  rsvpStatus: z.enum(RSVP_STATUSES).optional(),
});
export type GuestFormValues = z.input<typeof guestSchema>;

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Données invalides.");
  return r.data;
}

const path = (eventId: string) => `/app/evenements/${eventId}/invites`;

export async function createGuestAction(eventId: string, input: GuestFormValues): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    const v = parse(guestSchema, input);
    const row = await createGuest(actor, id, { ...v, groupId: v.groupId || null, ageYears: v.ageYears ?? null });
    revalidatePath(path(id));
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateGuestAction(eventId: string, guestId: string, input: GuestFormValues): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    const v = parse(guestSchema, input);
    const row = await updateGuest(actor, id, parse(uuid, guestId), { ...v, groupId: v.groupId || null, ageYears: v.ageYears ?? null });
    revalidatePath(path(id));
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteGuestAction(eventId: string, guestId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    await deleteGuest(actor, id, parse(uuid, guestId));
    revalidatePath(path(id));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

const groupSchema = z.object({ name: z.string().trim().min(1, "Nom requis.").max(80), side: z.string().trim().max(30).optional().nullable() });

export async function createGroupAction(eventId: string, input: { name: string; side?: string | null }): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    const row = await createGroup(actor, id, parse(groupSchema, input));
    revalidatePath(path(id));
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateGroupAction(eventId: string, groupId: string, input: { name: string; side?: string | null }): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    await updateGroup(actor, id, parse(uuid, groupId), parse(groupSchema, input));
    revalidatePath(path(id));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteGroupAction(eventId: string, groupId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    await deleteGroup(actor, id, parse(uuid, groupId));
    revalidatePath(path(id));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addFromContactsAction(eventId: string, contactIds: string[], groupId: string | null): Promise<ActionResult<{ created: number; skipped: number }>> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    const ids = parse(z.array(uuid).min(1).max(500), contactIds);
    const result = await addGuestsFromContacts(actor, id, ids, groupId ? parse(uuid, groupId) : null);
    revalidatePath(path(id));
    return { ok: true, data: result };
  } catch (e) {
    return toActionError(e);
  }
}

const draftSchema = z.object({
  line: z.number().int(),
  firstName: z.string().max(80),
  lastName: z.string().max(80),
  email: z.string().max(200).nullable(),
  phone: z.string().max(40).nullable(),
  groupName: z.string().max(80).nullable(),
  isChild: z.boolean(),
  ageYears: z.number().int().min(0).max(17).nullable(),
  dietaryPreference: z.string().max(80).nullable(),
  plusOnesAllowed: z.number().int().min(0).max(10),
  notes: z.string().max(2000).nullable(),
});

export async function importGuestsAction(eventId: string, input: { drafts: GuestDraft[] }): Promise<ActionResult<{ created: number; groupsCreated: number }>> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    const drafts = parse(z.array(draftSchema).min(1).max(2000), input.drafts);
    const result = await importGuests(actor, id, drafts);
    revalidatePath(path(id));
    return { ok: true, data: result };
  } catch (e) {
    return toActionError(e);
  }
}
