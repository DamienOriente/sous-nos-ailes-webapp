"use server";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { toActionError, ValidationError, type ActionResult } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { createEntry, deleteEntry, entryInputSchema, excludeOccurrence, getUserTimezone, updateEntry } from "@/modules/calendar/application/calendar-service";
import { connectionOptionsSchema, disconnect, requireCalendarSyncEntitlement, requireOwnConnection, updateConnectionOptions } from "@/modules/calendar/application/connections-service";
import { importIcs, previewIcsImport, type ImportPreview } from "@/modules/calendar/application/ics-import";
import { runCalendarSyncJob } from "@/modules/calendar/application/sync-engine";
import { parseLocalDateTime } from "@/modules/calendar/domain/datetime";
import { MAX_ICS_BYTES } from "@/modules/calendar/domain/ics";

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] = [...(out[key] ?? []), issue.message];
  }
  return out;
}
function invalid(error: z.ZodError): ActionResult<never> {
  return { ok: false, error: error.issues[0]?.message ?? new ValidationError().message, code: "validation", fieldErrors: fieldErrors(error) };
}

async function parseEntryForm(fd: FormData, userId: string) {
  const tz = String(fd.get("timezone") ?? "") || (await getUserTimezone(userId));
  const allDay = fd.get("allDay") === "on" || fd.get("allDay") === "true";
  const startRaw = String(fd.get("startsAt") ?? "");
  const endRaw = String(fd.get("endsAt") ?? "");
  // All-day entries are stored as [00:00 day, 00:00 next day) in the entry's zone.
  const startsAt = allDay ? parseLocalDateTime(startRaw.slice(0, 10), tz) : parseLocalDateTime(startRaw, tz);
  const endBase = allDay ? parseLocalDateTime((endRaw || startRaw).slice(0, 10), tz) : parseLocalDateTime(endRaw, tz);
  const endsAt = allDay && endBase ? new Date(endBase.getTime() + 86_400_000) : endBase;
  const rrulePreset = String(fd.get("rrulePreset") ?? "");
  const rrule = rrulePreset === "custom" ? String(fd.get("rrule") ?? "") : rrulePreset === "none" ? "" : rrulePreset;
  const reminder = String(fd.get("reminderMinutesBefore") ?? "");
  const pro = String(fd.get("professionalId") ?? "");
  return entryInputSchema.safeParse({
    title: fd.get("title"),
    description: fd.get("description") ?? "",
    location: fd.get("location") ?? "",
    kind: fd.get("kind") ?? "other",
    startsAt: startsAt ?? "invalid",
    endsAt: endsAt ?? "invalid",
    allDay,
    timezone: tz,
    rrule,
    reminderMinutesBefore: reminder && reminder !== "none" ? Number(reminder) : null,
    professionalId: pro && pro !== "none" ? pro : null,
  });
}

export async function createEntryAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = await parseEntryForm(fd, actor.userId);
    if (!parsed.success) return invalid(parsed.error);
    const res = await createEntry(actor, parsed.data);
    revalidatePath("/app/calendrier");
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateEntryAction(entryId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const parsed = await parseEntryForm(fd, actor.userId);
    if (!parsed.success) return invalid(parsed.error);
    await updateEntry(actor, entryId, parsed.data);
    revalidatePath("/app/calendrier");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteEntryAction(entryId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await deleteEntry(actor, entryId);
    revalidatePath("/app/calendrier");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function excludeOccurrenceAction(entryId: string, occurrenceStartIso: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    const d = new Date(occurrenceStartIso);
    if (Number.isNaN(d.getTime())) throw new ValidationError("Occurrence invalide.");
    await excludeOccurrence(actor, entryId, d);
    revalidatePath("/app/calendrier");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

// ── ICS import ──────────────────────────────────────────────────────────────
export type ImportPreviewClient = Omit<ImportPreview, "toCreate" | "toUpdate"> & { toCreate: Array<{ uid: string; title: string; startsAt: string; endsAt: string; allDay: boolean; rrule: string | null }>; toUpdate: Array<{ uid: string; title: string; startsAt: string }> };

export async function previewIcsAction(text: string): Promise<ActionResult<ImportPreviewClient>> {
  try {
    const actor = await requireActorOrThrow();
    if (Buffer.byteLength(text, "utf8") > MAX_ICS_BYTES) throw new ValidationError("Fichier trop volumineux (max 1 Mo).");
    const p = await previewIcsImport(actor, text);
    return {
      ok: true,
      data: {
        errors: p.errors,
        skipped: p.skipped,
        toCreate: p.toCreate.map((e) => ({ uid: e.uid, title: e.title, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(), allDay: e.allDay, rrule: e.rrule })),
        toUpdate: p.toUpdate.map((e) => ({ uid: e.uid, title: e.title, startsAt: e.startsAt.toISOString() })),
      },
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function importIcsAction(text: string, professionalId: string | null): Promise<ActionResult<{ created: number; updated: number; skipped: number }>> {
  try {
    const actor = await requireActorOrThrow();
    if (Buffer.byteLength(text, "utf8") > MAX_ICS_BYTES) throw new ValidationError("Fichier trop volumineux (max 1 Mo).");
    const res = await importIcs(actor, text, { professionalId });
    revalidatePath("/app/calendrier");
    return { ok: true, data: res };
  } catch (e) {
    return toActionError(e);
  }
}

// ── Connections ─────────────────────────────────────────────────────────────
export async function updateConnectionOptionsAction(connectionId: string, fd: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await requireCalendarSyncEntitlement(actor);
    const parsed = connectionOptionsSchema.safeParse(Object.fromEntries(fd.entries()));
    if (!parsed.success) return invalid(parsed.error);
    await updateConnectionOptions(actor, connectionId, parsed.data);
    revalidatePath("/app/calendrier/connexions");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function disconnectAction(connectionId: string): Promise<ActionResult> {
  try {
    const actor = await requireActorOrThrow();
    await disconnect(actor, connectionId);
    revalidatePath("/app/calendrier/connexions");
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}

/** Runs the sync inline (short for personal calendars). The worker also runs it on schedule. */
export async function syncNowAction(connectionId: string): Promise<ActionResult<{ pushed: number; pulled: number; conflicts: number }>> {
  try {
    const actor = await requireActorOrThrow();
    await requireCalendarSyncEntitlement(actor);
    // Ownership check: runCalendarSyncJob is internal; make sure the connection belongs to the actor.
    await requireOwnConnection(actor, connectionId);
    const res = await runCalendarSyncJob(connectionId);
    revalidatePath("/app/calendrier/connexions");
    revalidatePath("/app/calendrier");
    return { ok: true, data: res };
  } catch (e) {
    revalidatePath("/app/calendrier/connexions");
    return toActionError(e);
  }
}
