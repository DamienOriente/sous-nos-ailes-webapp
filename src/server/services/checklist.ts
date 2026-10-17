import type { Prisma } from "@/lib/db";
import { db } from "@/lib/db";
import { buildChecklist } from "@/domain/checklist";
import { durationMinutes } from "@/lib/time";
import { NotFoundError } from "@/server/errors";

/** Inserts the adaptive checklist items that are missing; never resets done items. */
export async function syncChecklistForEvent(tx: Prisma.TransactionClient | typeof db, eventId: string): Promise<void> {
  const event = await tx.event.findUnique({ where: { id: eventId }, include: { venue: { include: { notes: { select: { id: true } } } } } });
  if (!event) throw new NotFoundError("Événement introuvable.");
  const crossesMidnight = Boolean(event.startsAt && event.endsAt && event.endDate && event.date && event.endDate.getTime() !== event.date.getTime());
  const items = buildChecklist({
    dateIsFlexible: event.dateIsFlexible,
    hasDate: Boolean(event.date),
    hasTimes: Boolean(event.startTime && event.endTime),
    crossesMidnight,
    durationMinutes: event.startsAt && event.endsAt ? durationMinutes(event.startsAt, event.endsAt) : 0,
    dedicatedSpace: event.dedicatedSpace,
    hasSpaceDescription: Boolean(event.spaceDescription),
    hasMeetingPoint: Boolean(event.meetingPoint),
    hasOnSiteContact: Boolean(event.onSiteContactName && event.onSiteContactPhone),
    parentsOnSite: event.parentsOnSite,
    childrenUnder3: event.childrenUnder3,
    hasPartnerVenue: Boolean(event.venueId),
    hasVenueMemory: Boolean(event.venue && event.venue.notes.length > 0),
  });
  const existing = await tx.checklistItem.findMany({ where: { eventId }, select: { key: true } });
  const existingKeys = new Set(existing.map((i) => i.key).filter(Boolean));
  const missing = items.filter((item) => !existingKeys.has(item.key));
  if (missing.length) {
    await tx.checklistItem.createMany({
      data: missing.map((item, index) => ({ eventId, key: item.key, label: item.label, isAuto: true, sortOrder: existing.length + index })),
    });
  }
}

export async function setChecklistItemDone(eventId: string, itemId: string, done: boolean): Promise<void> {
  const result = await db.checklistItem.updateMany({
    where: { id: itemId, eventId },
    data: { isDone: done, doneAt: done ? new Date() : null },
  });
  if (result.count === 0) throw new NotFoundError("Élément de checklist introuvable.");
}

export async function addChecklistItem(eventId: string, label: string): Promise<void> {
  const count = await db.checklistItem.count({ where: { eventId } });
  await db.checklistItem.create({ data: { eventId, label, isAuto: false, sortOrder: count } });
}

export async function removeChecklistItem(eventId: string, itemId: string): Promise<void> {
  await db.checklistItem.deleteMany({ where: { id: itemId, eventId } });
}
