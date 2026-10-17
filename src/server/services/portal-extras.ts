import { db } from "@/lib/db";
import { expireStaleInvitations } from "@/server/services/invitations";

// Additive read helpers for the self-service portals. Every function scopes
// its query to the acting user so pages can `notFound()` on a null result.

const MISSION_VENUE_SELECT = { name: true, city: true, accessInfo: true, constraints: true, childrenSpaces: true } as const;

/**
 * A mission as seen by one provider. Readable only when they were invited
 * (withdrawn invitations excluded) or are currently assigned.
 */
export async function getMissionForProvider(eventId: string, providerId: string) {
  await expireStaleInvitations();
  const [invitation, assignment] = await Promise.all([
    db.missionInvitation.findUnique({ where: { eventId_providerId: { eventId, providerId } } }),
    db.assignment.findFirst({ where: { eventId, providerId, status: "ASSIGNED" } }),
  ]);
  const visibleInvitation = invitation && invitation.status !== "WITHDRAWN" ? invitation : null;
  if (!visibleInvitation && !assignment) return null;
  const event = await db.event.findUnique({ where: { id: eventId }, include: { venue: { select: MISSION_VENUE_SELECT } } });
  if (!event) return null;
  return { event, invitation: visibleInvitation, assignment, assigned: Boolean(assignment) };
}

/** Printable brief data: only for an assigned provider. Team members without phone numbers. */
export async function getMissionBriefForProvider(eventId: string, providerId: string) {
  const assignment = await db.assignment.findFirst({ where: { eventId, providerId, status: "ASSIGNED" }, select: { id: true } });
  if (!assignment) return null;
  const [event, team] = await Promise.all([
    db.event.findUnique({ where: { id: eventId }, include: { venue: { select: MISSION_VENUE_SELECT } } }),
    db.assignment.findMany({
      where: { eventId, status: "ASSIGNED" },
      include: { provider: { select: { displayName: true } } },
      orderBy: { assignedAt: "asc" },
    }),
  ]);
  if (!event) return null;
  return { event, team: team.map((member) => ({ displayName: member.provider.displayName, roleLabel: member.roleLabel })) };
}

/** Declared periods split around the current instant (past ones are only kept for reference). */
export async function listAvailabilitiesForProvider(providerId: string, now: Date = new Date()) {
  const rows = await db.availability.findMany({ where: { providerId }, orderBy: { startsAt: "asc" } });
  const reference = now.getTime();
  return {
    upcoming: rows.filter((row) => row.endsAt.getTime() >= reference),
    past: rows.filter((row) => row.endsAt.getTime() < reference),
  };
}

export async function listQualificationsForProvider(providerId: string) {
  return db.providerQualification.findMany({ where: { providerId }, orderBy: { createdAt: "asc" } });
}

/** The organiser's original free-text message, scoped to the owning client. */
export async function getClientRequestMessage(eventId: string, clientUserId: string): Promise<string | null> {
  const request = await db.eventRequest.findFirst({ where: { event: { id: eventId, clientId: clientUserId } }, select: { message: true } });
  return request?.message ?? null;
}
