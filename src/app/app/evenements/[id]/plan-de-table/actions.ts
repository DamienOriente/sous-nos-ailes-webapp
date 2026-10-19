"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { TABLE_SHAPES } from "@/modules/seating/domain/geometry";
import { assignGuest, createTable, deleteTable, moveGuest, moveTable, unassignGuest, updateTable, type SeatingTableRecord } from "@/modules/seating/application/seating-service";

const uuid = z.string().uuid();
const tableSchema = z.object({ name: z.string().trim().min(1, "Nom requis.").max(60), shape: z.enum(TABLE_SHAPES), capacity: z.number().int().min(1).max(40), x: z.number().optional(), y: z.number().optional(), rotation: z.number().optional() });
export type TableFormValues = z.input<typeof tableSchema>;

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Données invalides.");
  return r.data;
}
const path = (eventId: string) => `/app/evenements/${eventId}/plan-de-table`;

export async function createTableAction(eventId: string, input: TableFormValues): Promise<ActionResult<SeatingTableRecord>> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    const row = await createTable(actor, id, parse(tableSchema, input));
    revalidatePath(path(id));
    return { ok: true, data: row };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateTableAction(eventId: string, tableId: string, input: TableFormValues): Promise<ActionResult<SeatingTableRecord>> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    const row = await updateTable(actor, id, parse(uuid, tableId), parse(tableSchema, input));
    revalidatePath(path(id));
    return { ok: true, data: row };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteTableAction(eventId: string, tableId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    await deleteTable(actor, id, parse(uuid, tableId));
    revalidatePath(path(id));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

/** Debounced from the canvas: no revalidation (the client already shows the new position). */
export async function moveTableAction(eventId: string, tableId: string, position: { x: number; y: number }): Promise<ActionResult<{ x: number; y: number }>> {
  try {
    const actor = await requireActorOrThrow();
    const pos = parse(z.object({ x: z.number(), y: z.number() }), position);
    const settled = await moveTable(actor, parse(uuid, eventId), parse(uuid, tableId), pos);
    return { ok: true, data: settled };
  } catch (e) {
    return toActionError(e);
  }
}

export async function assignGuestAction(eventId: string, guestId: string, tableId: string, mode: "assign" | "move" = "assign"): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    const fn = mode === "move" ? moveGuest : assignGuest;
    await fn(actor, id, parse(uuid, guestId), parse(uuid, tableId));
    revalidatePath(path(id));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function unassignGuestAction(eventId: string, guestId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const id = parse(uuid, eventId);
    await unassignGuest(actor, id, parse(uuid, guestId));
    revalidatePath(path(id));
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
