import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db";
import type { EventStatus, TriState } from "@/generated/prisma/enums";
import { assertTransition, checkConfirmation, clientStageFor, computeTeamStatus, type TeamStatus } from "@/domain/workflow";
import { computeReadiness, type Readiness } from "@/domain/readiness";
import { suggestProviderCount } from "@/domain/staffing";
import { EVENT_TYPE_LABELS, type HeadcountByAge } from "@/domain/labels";
import { computeEventInstants, formatDateOnlyShort, parseDateOnly } from "@/lib/time";
import { getSettings, staffingRatiosFrom } from "@/server/services/settings";
import { recordAudit } from "@/server/services/audit";
import { syncChecklistForEvent } from "@/server/services/checklist";
import { findAssignmentConflicts } from "@/server/services/assignments";
import { DomainError, NotFoundError } from "@/server/errors";
import type { SessionUser } from "@/lib/auth/session";

export type AdminEventFilters = {
  status?: EventStatus | "ACTIVE" | "ALL";
  search?: string;
  venueId?: string;
  from?: string;
  to?: string;
  teamIncomplete?: boolean;
};

const ACTIVE: EventStatus[] = ["NEW", "QUALIFYING", "PROPOSAL_SENT", "AGREED", "PREPARING", "CONFIRMED"];

export async function listEventsForAdmin(filters: AdminEventFilters = {}) {
  const where: Prisma.EventWhereInput = {};
  if (!filters.status || filters.status === "ACTIVE") where.status = { in: ACTIVE };
  else if (filters.status !== "ALL") where.status = filters.status;
  if (filters.venueId) where.venueId = filters.venueId;
  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
      { client: { email: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (filters.from) where.date = { ...(where.date as Prisma.DateTimeNullableFilter), gte: parseDateOnly(filters.from) };
  if (filters.to) where.date = { ...(where.date as Prisma.DateTimeNullableFilter), lte: parseDateOnly(filters.to) };

  const events = await db.event.findMany({
    where,
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
    include: {
      client: { select: { name: true, email: true } },
      venue: { select: { name: true, slug: true } },
      assignments: { where: { status: "ASSIGNED" }, select: { id: true } },
      invitations: { where: { status: { in: ["PENDING", "ACCEPTED"] } }, select: { status: true, assignment: { select: { id: true } } } },
      quote: { include: { versions: { where: { status: { in: ["SENT", "ACCEPTED"] } }, orderBy: { number: "desc" }, take: 1 } } },
      request: { select: { source: true } },
    },
  });
  const rows = events.map((event) => {
    const teamStatus = computeTeamStatus({
      requiredProviders: event.requiredProviders,
      assignedCount: event.assignments.length,
      pendingInvitations: event.invitations.filter((i) => i.status === "PENDING").length,
      acceptedInvitationsNotAssigned: event.invitations.filter((i) => i.status === "ACCEPTED" && !i.assignment).length,
    });
    return { ...event, teamStatus, currentQuote: event.quote?.versions[0] ?? null };
  });
  return filters.teamIncomplete ? rows.filter((r) => r.teamStatus !== "COMPLETE") : rows;
}

export type AdminEventDetail = NonNullable<Awaited<ReturnType<typeof getEventForAdmin>>>;

export async function getEventForAdmin(eventId: string) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      request: { include: { referral: { include: { venue: { select: { name: true, slug: true } } } } } },
      client: { select: { id: true, name: true, email: true, phone: true } },
      venue: { include: { notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } } } },
      quote: { include: { versions: { include: { lines: { orderBy: { sortOrder: "asc" } }, acceptedBy: { select: { name: true } } }, orderBy: { number: "desc" } } } },
      invitations: { include: { provider: { include: { user: { select: { name: true, email: true } } } }, assignment: { select: { id: true, status: true } } }, orderBy: { sentAt: "desc" } },
      assignments: { include: { provider: { include: { user: { select: { name: true, email: true, phone: true } } } } }, orderBy: { assignedAt: "asc" } },
      checklist: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!event) return null;
  const settings = await getSettings();
  const activeAssignments = event.assignments.filter((a) => a.status === "ASSIGNED");
  const teamStatus = computeTeamStatus({
    requiredProviders: event.requiredProviders,
    assignedCount: activeAssignments.length,
    pendingInvitations: event.invitations.filter((i) => i.status === "PENDING").length,
    acceptedInvitationsNotAssigned: event.invitations.filter((i) => i.status === "ACCEPTED" && !i.assignment).length,
  });
  const currentQuote = event.quote?.versions.find((v) => v.status === "ACCEPTED" || v.status === "SENT") ?? null;
  const hasAcceptedQuote = currentQuote?.status === "ACCEPTED";
  const assignmentConflicts =
    event.startsAt && event.endsAt
      ? await Promise.all(
          activeAssignments.map(async (assignment) => ({
            assignmentId: assignment.id,
            conflicts: await findAssignmentConflicts({
              providerId: assignment.providerId,
              interval: { startsAt: event.startsAt!, endsAt: event.endsAt! },
              bufferMinutes: settings.travelBufferMinutes,
              excludeEventId: event.id,
            }),
          })),
        )
      : [];
  const hasBlockingConflict = assignmentConflicts.some((c) => c.conflicts.length > 0);
  const checklistDone = event.checklist.filter((i) => i.isDone).length;
  const readiness: Readiness = computeReadiness({
    hasDate: Boolean(event.date),
    dateIsFlexible: event.dateIsFlexible,
    hasTimes: Boolean(event.startsAt && event.endsAt),
    hasVenue: Boolean(event.venueId || event.venueName),
    spaceConfirmed: event.dedicatedSpace === "YES" && Boolean(event.spaceDescription),
    hasMeetingPoint: Boolean(event.meetingPoint),
    hasOnSiteContact: Boolean(event.onSiteContactName && event.onSiteContactPhone),
    hasHeadcount: event.childrenUnder3 + event.children3to5 + event.children6to10 + event.children11plus > 0,
    hasAcceptedQuote,
    teamStatus,
    checklistDone,
    checklistTotal: event.checklist.length,
    opsValidated: Boolean(event.opsValidatedAt),
  });
  const confirmation = checkConfirmation({
    status: event.status,
    hasAcceptedCurrentQuote: hasAcceptedQuote,
    teamStatus,
    hasBlockingConflict,
    opsValidated: Boolean(event.opsValidatedAt),
    hasFixedDate: Boolean(event.date && event.startsAt && event.endsAt && !event.dateIsFlexible),
  });
  const staffing = suggestProviderCount(headcountOf(event), staffingRatiosFrom(settings));
  const providerCostCents = activeAssignments.reduce((sum, a) => sum + a.agreedCostCents, 0);
  return {
    ...event,
    teamStatus,
    currentQuote,
    hasAcceptedQuote,
    assignmentConflicts,
    hasBlockingConflict,
    readiness,
    confirmation,
    staffing,
    providerCostCents,
    activeAssignments,
    settings,
  };
}

export function headcountOf(event: HeadcountByAge): HeadcountByAge {
  return {
    childrenUnder3: event.childrenUnder3,
    children3to5: event.children3to5,
    children6to10: event.children6to10,
    children11plus: event.children11plus,
  };
}

/** Client view, strictly scoped to the signed-in client. Never exposes notes or costs. */
export async function getEventForClient(eventId: string, clientUserId: string) {
  const event = await db.event.findFirst({
    where: { id: eventId, clientId: clientUserId },
    include: {
      venue: { select: { name: true, slug: true, city: true } },
      quote: { include: { versions: { where: { status: { in: ["SENT", "ACCEPTED", "SUPERSEDED"] } }, include: { lines: { orderBy: { sortOrder: "asc" } } }, orderBy: { number: "desc" } } } },
      assignments: { where: { status: "ASSIGNED" }, select: { id: true } },
    },
  });
  if (!event) return null;
  const currentQuote = event.quote?.versions.find((v) => v.status === "ACCEPTED" || v.status === "SENT") ?? null;
  const stage = clientStageFor(event.status);
  const teamStatus = computeTeamStatus({ requiredProviders: event.requiredProviders, assignedCount: event.assignments.length, pendingInvitations: 0, acceptedInvitationsNotAssigned: 0 });
  return { ...event, currentQuote, stage, teamStatus, teamAssigned: event.assignments.length };
}

export async function listEventsForClient(clientUserId: string) {
  const events = await db.event.findMany({
    where: { clientId: clientUserId },
    orderBy: [{ createdAt: "desc" }],
    include: { venue: { select: { name: true } } },
  });
  return events.map((event) => ({ ...event, stage: clientStageFor(event.status) }));
}

export async function transitionEvent(eventId: string, to: EventStatus, actor: SessionUser, reason?: string): Promise<void> {
  const detail = await getEventForAdmin(eventId);
  if (!detail) throw new NotFoundError("Événement introuvable.");
  assertTransition(detail.status, to);
  if (to === "CONFIRMED" && !detail.confirmation.ok) {
    throw new DomainError(`Confirmation impossible : ${detail.confirmation.blockers.join(" ")}`);
  }
  const data: Prisma.EventUpdateInput = { status: to };
  if (to === "DECLINED") data.declinedReason = reason ?? null;
  if (to === "CANCELLED") data.cancelledReason = reason ?? null;
  if (to === "CONFIRMED") data.confirmedAt = new Date();
  if (to === "COMPLETED") data.completedAt = new Date();
  await db.$transaction(async (tx) => {
    await tx.event.update({ where: { id: eventId }, data });
    await recordAudit(
      { actorId: actor.id, actorRole: actor.role, action: `event.status.${to.toLowerCase()}`, entityType: "Event", entityId: eventId, summary: `${detail.status} → ${to}${reason ? ` (${reason})` : ""}` },
      tx,
    );
  });
}

export type EventDetailsUpdate = {
  eventType?: Parameters<typeof EVENT_TYPE_LABELS extends Record<infer K, string> ? (k: K) => void : never>[0];
  date?: string | null;
  endDate?: string | null;
  dateIsFlexible?: boolean;
  dateNote?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venueId?: string | null;
  venueName?: string | null;
  venueAddressNote?: string | null;
  city?: string;
  postalCode?: string;
  childrenUnder3?: number;
  children3to5?: number;
  children6to10?: number;
  children11plus?: number;
  parentsOnSite?: TriState;
  dedicatedSpace?: TriState;
  requiredProviders?: number;
  spaceDescription?: string | null;
  meetingPoint?: string | null;
  onSiteContactName?: string | null;
  onSiteContactPhone?: string | null;
  scheduleNotes?: string | null;
};

export async function updateEventDetails(eventId: string, update: EventDetailsUpdate, actor: SessionUser): Promise<void> {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFoundError("Événement introuvable.");
  const date = update.date !== undefined ? update.date : event.date ? event.date.toISOString().slice(0, 10) : null;
  const endDate = update.endDate !== undefined ? update.endDate : event.endDate ? event.endDate.toISOString().slice(0, 10) : null;
  const startTime = update.startTime !== undefined ? update.startTime : event.startTime;
  const endTime = update.endTime !== undefined ? update.endTime : event.endTime;
  const instants = date && startTime && endTime ? computeEventInstants({ date, endDate, startTime, endTime }) : null;
  const eventType = update.eventType ?? event.eventType;
  const city = update.city ?? event.city;
  const data: Prisma.EventUncheckedUpdateInput = {
    ...update,
    eventType,
    date: date ? parseDateOnly(date) : null,
    endDate: instants ? parseDateOnly(instants.endDateOnly) : endDate ? parseDateOnly(endDate) : null,
    startTime,
    endTime,
    startsAt: instants?.startsAt ?? null,
    endsAt: instants?.endsAt ?? null,
    title: `${EVENT_TYPE_LABELS[eventType]} — ${city}${date ? ` — ${formatDateOnlyShort(date)}` : ""}`,
  };
  if (update.venueId !== undefined) {
    const venue = update.venueId ? await db.partnerVenue.findUnique({ where: { id: update.venueId } }) : null;
    data.venueId = venue?.id ?? null;
    if (venue) data.venueName = venue.name;
  }
  await db.$transaction(async (tx) => {
    await tx.event.update({ where: { id: eventId }, data });
    await syncChecklistForEvent(tx, eventId);
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "event.updated", entityType: "Event", entityId: eventId, summary: "Fiche événement modifiée" }, tx);
  });
}

export async function updateClientPreparation(
  eventId: string,
  clientUserId: string,
  answers: { spaceDescription?: string | null; meetingPoint?: string | null; onSiteContactName?: string | null; onSiteContactPhone?: string | null; scheduleNotes?: string | null; dedicatedSpace?: TriState },
): Promise<void> {
  const event = await db.event.findFirst({ where: { id: eventId, clientId: clientUserId }, select: { id: true, status: true } });
  if (!event) throw new NotFoundError("Dossier introuvable.");
  if (["COMPLETED", "CANCELLED", "DECLINED"].includes(event.status)) throw new DomainError("Ce dossier est clos.");
  await db.$transaction(async (tx) => {
    await tx.event.update({ where: { id: eventId }, data: answers });
    await syncChecklistForEvent(tx, eventId);
    await recordAudit({ actorId: clientUserId, actorRole: "CLIENT", action: "event.preparation.answered", entityType: "Event", entityId: eventId, summary: "Réponses de préparation mises à jour par le client" }, tx);
  });
}

export async function validateOperations(eventId: string, actor: SessionUser, validated: boolean): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.event.update({ where: { id: eventId }, data: { opsValidatedAt: validated ? new Date() : null } });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: validated ? "event.ops.validated" : "event.ops.unvalidated", entityType: "Event", entityId: eventId }, tx);
  });
}

export async function listEventsForPlanning(from: Date, to: Date) {
  return db.event.findMany({
    where: { status: { in: ACTIVE }, OR: [{ startsAt: { gte: from, lte: to } }, { startsAt: null, date: { gte: from, lte: to } }] },
    orderBy: [{ startsAt: "asc" }, { date: "asc" }],
    include: {
      venue: { select: { name: true } },
      assignments: { where: { status: "ASSIGNED" }, include: { provider: { select: { displayName: true } } } },
    },
  });
}

export function teamStatusLabelTone(status: TeamStatus): "neutral" | "warning" | "sage" | "info" {
  switch (status) {
    case "COMPLETE":
      return "sage";
    case "PARTIAL":
      return "warning";
    case "INVITING":
      return "info";
    default:
      return "neutral";
  }
}
