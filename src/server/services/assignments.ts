import { db, Prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { findConflicts, type Conflict, type Interval } from "@/domain/scheduling";
import { getSettings } from "@/server/services/settings";
import { recordAudit } from "@/server/services/audit";
import { ConflictError, DomainError, NotFoundError } from "@/server/errors";

type Tx = Prisma.TransactionClient;

/** Conflicts for a provider on an interval: other assignments (with buffer) and declared unavailability. */
export async function findAssignmentConflicts(
  input: { providerId: string; interval: Interval; bufferMinutes: number; excludeEventId?: string },
  tx: Tx | typeof db = db,
): Promise<Conflict[]> {
  const windowStart = new Date(input.interval.startsAt.getTime() - 2 * 24 * 60 * 60_000);
  const windowEnd = new Date(input.interval.endsAt.getTime() + 2 * 24 * 60 * 60_000);
  const [assignments, unavailabilities] = await Promise.all([
    tx.assignment.findMany({
      where: {
        providerId: input.providerId,
        status: "ASSIGNED",
        eventId: input.excludeEventId ? { not: input.excludeEventId } : undefined,
        event: { startsAt: { lte: windowEnd }, endsAt: { gte: windowStart } },
      },
      include: { event: { select: { id: true, reference: true, startsAt: true, endsAt: true } } },
    }),
    tx.availability.findMany({
      where: { providerId: input.providerId, kind: "UNAVAILABLE", startsAt: { lte: windowEnd }, endsAt: { gte: windowStart } },
    }),
  ]);
  return findConflicts({
    candidate: input.interval,
    bufferMinutes: input.bufferMinutes,
    assignments: assignments
      .filter((a) => a.event.startsAt && a.event.endsAt)
      .map((a) => ({ id: a.id, eventId: a.event.id, eventReference: a.event.reference, startsAt: a.event.startsAt!, endsAt: a.event.endsAt! })),
    unavailabilities: unavailabilities.map((u) => ({ id: u.id, startsAt: u.startsAt, endsAt: u.endsAt, note: u.note })),
  });
}

export type AssignInput = {
  eventId: string;
  providerId: string;
  invitationId?: string | null;
  agreedCostCents?: number;
  roleLabel?: string | null;
};

/**
 * Assigns a provider to an event inside a transaction that locks the provider
 * row (SELECT … FOR UPDATE). Two concurrent incompatible assignments for the
 * same provider therefore serialise: the second one sees the first and fails.
 */
export async function assignProvider(input: AssignInput, actor: SessionUser) {
  const settings = await getSettings();
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ProviderProfile" WHERE "id" = ${input.providerId} FOR UPDATE`;
      const [event, provider] = await Promise.all([
        tx.event.findUnique({ where: { id: input.eventId }, include: { assignments: { where: { status: "ASSIGNED" } } } }),
        tx.providerProfile.findUnique({ where: { id: input.providerId } }),
      ]);
      if (!event) throw new NotFoundError("Événement introuvable.");
      if (!provider) throw new NotFoundError("Intervenant·e introuvable.");
      if (!provider.isActive || provider.vettingStatus === "PAUSED") throw new DomainError("Ce profil est inactif ou en pause.");
      if (!event.startsAt || !event.endsAt) throw new DomainError("Fixez la date et les horaires avant d’affecter une personne.");
      if (["COMPLETED", "CANCELLED", "DECLINED"].includes(event.status)) throw new DomainError("Ce dossier est clos.");
      if (event.assignments.some((a) => a.providerId === input.providerId)) throw new DomainError("Cette personne est déjà affectée à cet événement.");
      if (event.assignments.length >= event.requiredProviders) {
        throw new DomainError(`L’équipe prévue (${event.requiredProviders}) est déjà complète. Augmentez l’effectif requis pour ajouter une personne.`);
      }
      const conflicts = await findAssignmentConflicts(
        { providerId: input.providerId, interval: { startsAt: event.startsAt, endsAt: event.endsAt }, bufferMinutes: settings.travelBufferMinutes, excludeEventId: event.id },
        tx,
      );
      if (conflicts.length) {
        throw new ConflictError("Affectation impossible : conflit horaire.", conflicts.map((c) => c.explanation));
      }
      let invitationId = input.invitationId ?? null;
      if (!invitationId) {
        const invitation = await tx.missionInvitation.findUnique({ where: { eventId_providerId: { eventId: event.id, providerId: input.providerId } } });
        invitationId = invitation?.id ?? null;
      }
      const assignment = await tx.assignment.create({
        data: {
          eventId: event.id,
          providerId: input.providerId,
          invitationId,
          agreedCostCents: input.agreedCostCents ?? provider.agreedCostCents,
          roleLabel: input.roleLabel ?? null,
        },
      });
      await recordAudit(
        { actorId: actor.id, actorRole: actor.role, action: "assignment.created", entityType: "Event", entityId: event.id, summary: `${provider.displayName} affecté·e` },
        tx,
      );
      return assignment;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5_000, timeout: 15_000 },
  );
}

export async function cancelAssignment(assignmentId: string, actor: SessionUser, reason?: string): Promise<void> {
  const assignment = await db.assignment.findUnique({ where: { id: assignmentId }, include: { provider: true } });
  if (!assignment) throw new NotFoundError("Affectation introuvable.");
  if (assignment.status === "CANCELLED") return;
  await db.$transaction(async (tx) => {
    // Free the unique (eventId, providerId) slot by deleting; keep an audit trail instead of a tombstone.
    await tx.assignment.delete({ where: { id: assignmentId } });
    await recordAudit(
      { actorId: actor.id, actorRole: actor.role, action: "assignment.cancelled", entityType: "Event", entityId: assignment.eventId, summary: `${assignment.provider.displayName} retiré·e de l’équipe${reason ? ` (${reason})` : ""}` },
      tx,
    );
  });
}

export async function listAssignmentsForProvider(providerId: string) {
  return db.assignment.findMany({
    where: { providerId, status: "ASSIGNED" },
    include: { event: { include: { venue: { select: { name: true, city: true, accessInfo: true } } } } },
    orderBy: { event: { startsAt: "asc" } },
  });
}
