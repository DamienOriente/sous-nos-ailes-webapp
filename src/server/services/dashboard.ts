import { db } from "@/lib/db";
import { computeTeamStatus } from "@/domain/workflow";
import { expireStaleInvitations } from "@/server/services/invitations";

export async function getAdminDashboard() {
  await expireStaleInvitations();
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
  const [byStatus, upcoming, pendingInvitations, newApplications, venuesToReview, unhandledContacts, recentAudit] = await Promise.all([
    db.event.groupBy({ by: ["status"], _count: { _all: true } }),
    db.event.findMany({
      where: { status: { in: ["AGREED", "PREPARING", "CONFIRMED"] }, startsAt: { gte: now, lte: in30Days } },
      orderBy: { startsAt: "asc" },
      include: {
        venue: { select: { name: true } },
        assignments: { where: { status: "ASSIGNED" }, select: { id: true } },
        invitations: { where: { status: { in: ["PENDING", "ACCEPTED"] } }, select: { status: true, assignment: { select: { id: true } } } },
      },
    }),
    db.missionInvitation.count({ where: { status: "PENDING" } }),
    db.application.count({ where: { status: "NEW" } }),
    db.partnerVenue.count({ where: { editorialStatus: "REVIEW" } }),
    db.contactMessage.count({ where: { handledAt: null } }),
    db.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { actor: { select: { name: true } } } }),
  ]);
  const counts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])) as Record<string, number>;
  const upcomingWithTeam = upcoming.map((event) => ({
    ...event,
    teamStatus: computeTeamStatus({
      requiredProviders: event.requiredProviders,
      assignedCount: event.assignments.length,
      pendingInvitations: event.invitations.filter((i) => i.status === "PENDING").length,
      acceptedInvitationsNotAssigned: event.invitations.filter((i) => i.status === "ACCEPTED" && !i.assignment).length,
    }),
  }));
  return {
    counts,
    newRequests: (counts.NEW ?? 0) + (counts.QUALIFYING ?? 0),
    awaitingClient: counts.PROPOSAL_SENT ?? 0,
    inPreparation: (counts.AGREED ?? 0) + (counts.PREPARING ?? 0),
    confirmed: counts.CONFIRMED ?? 0,
    upcoming: upcomingWithTeam,
    incompleteTeams: upcomingWithTeam.filter((e) => e.teamStatus !== "COMPLETE"),
    pendingInvitations,
    newApplications,
    venuesToReview,
    unhandledContacts,
    recentAudit,
  };
}
