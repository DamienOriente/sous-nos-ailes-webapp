import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { createMagicLink } from "@/lib/auth/magic-link";
import { sendMail } from "@/lib/mail";
import { getEnv } from "@/lib/env";
import { formatEventWindow } from "@/lib/time";
import { getSettings } from "@/server/services/settings";
import { recordAudit } from "@/server/services/audit";
import { findAssignmentConflicts } from "@/server/services/assignments";
import { availabilityStatusFor } from "@/domain/scheduling";
import { rankProviderCandidates, type RankedCandidate } from "@/domain/staffing";
import { DomainError, NotFoundError } from "@/server/errors";

/** Marks pending invitations past their expiry. Called lazily before reads. */
export async function expireStaleInvitations(): Promise<void> {
  await db.missionInvitation.updateMany({ where: { status: "PENDING", expiresAt: { lt: new Date() } }, data: { status: "EXPIRED" } });
}

/** Candidate providers for an event, ranked with explicit reasons. */
export async function suggestProvidersForEvent(eventId: string): Promise<RankedCandidate[]> {
  const [event, settings, providers] = await Promise.all([
    db.event.findUnique({ where: { id: eventId }, include: { invitations: true, assignments: { where: { status: "ASSIGNED" } } } }),
    getSettings(),
    db.providerProfile.findMany({ include: { qualifications: true, availabilities: true, user: { select: { name: true } } }, orderBy: { displayName: "asc" } }),
  ]);
  if (!event) throw new NotFoundError("Événement introuvable.");
  const interval = event.startsAt && event.endsAt ? { startsAt: event.startsAt, endsAt: event.endsAt } : null;
  const candidates = await Promise.all(
    providers.map(async (provider) => ({
      providerId: provider.id,
      displayName: provider.displayName,
      sector: provider.sector,
      isActive: provider.isActive,
      vettingStatus: provider.vettingStatus,
      verifiedQualifications: provider.qualifications.filter((q) => q.status === "VERIFIED").length,
      skills: provider.skills,
      availability: interval ? availabilityStatusFor(interval, provider.availabilities.filter((a) => a.kind === "AVAILABLE")) : ("NOT_DECLARED" as const),
      conflicts: interval ? await findAssignmentConflicts({ providerId: provider.id, interval, bufferMinutes: settings.travelBufferMinutes, excludeEventId: event.id }) : [],
      alreadyInvited: event.invitations.some((i) => i.providerId === provider.id && i.status === "PENDING"),
      alreadyAssigned: event.assignments.some((a) => a.providerId === provider.id),
    })),
  );
  return rankProviderCandidates(candidates, { city: event.city, wantedSkills: event.optionCodes });
}

export async function inviteProviders(eventId: string, providerIds: string[], actor: SessionUser, message?: string | null): Promise<number> {
  const [event, settings] = await Promise.all([db.event.findUnique({ where: { id: eventId } }), getSettings()]);
  if (!event) throw new NotFoundError("Événement introuvable.");
  if (["COMPLETED", "CANCELLED", "DECLINED"].includes(event.status)) throw new DomainError("Ce dossier est clos.");
  if (!event.startsAt || !event.endsAt) throw new DomainError("Fixez la date et les horaires avant de proposer la mission.");
  const expiresAt = new Date(Date.now() + settings.invitationExpiryHours * 60 * 60_000);
  let sent = 0;
  for (const providerId of providerIds) {
    const provider = await db.providerProfile.findUnique({ where: { id: providerId }, include: { user: true } });
    if (!provider || !provider.isActive) continue;
    const existing = await db.missionInvitation.findUnique({ where: { eventId_providerId: { eventId, providerId } } });
    if (existing && (existing.status === "PENDING" || existing.status === "ACCEPTED")) continue;
    await db.$transaction(async (tx) => {
      if (existing) {
        await tx.missionInvitation.update({ where: { id: existing.id }, data: { status: "PENDING", message: message ?? null, sentAt: new Date(), expiresAt, respondedAt: null, responseNote: null } });
      } else {
        await tx.missionInvitation.create({ data: { eventId, providerId, message: message ?? null, expiresAt, proposedCostCents: provider.agreedCostCents } });
      }
      await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "invitation.sent", entityType: "Event", entityId: eventId, summary: `Mission proposée à ${provider.displayName}` }, tx);
    });
    sent += 1;
    const { url } = await createMagicLink(provider.userId);
    await sendMail(
      {
        to: provider.user.email,
        subject: `Proposition de mission — ${formatEventWindow({ date: event.date, startsAt: event.startsAt, endsAt: event.endsAt })}`,
        template: "mission-invitation",
        heading: "Une mission vous est proposée",
        paragraphs: [
          `Bonjour ${provider.displayName},`,
          `${settings.ownerFirstName} vous propose une mission : ${event.title}, ${formatEventWindow({ date: event.date, startsAt: event.startsAt, endsAt: event.endsAt })}, à ${event.city}.`,
          message ? `Message de ${settings.ownerFirstName} : ${message}` : "Les détails utiles sont dans votre espace.",
          `Vous êtes libre d’accepter ou de refuser. Accepter indique votre disponibilité ; l’affectation finale est confirmée par ${settings.ownerFirstName}. Cette proposition expire le ${expiresAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}.`,
        ],
        cta: { label: "Voir la proposition", url },
        entityType: "Event",
        entityId: eventId,
      },
      settings.brandName,
    );
  }
  return sent;
}

export async function respondToInvitation(invitationId: string, providerUserId: string, response: "ACCEPTED" | "DECLINED", note?: string | null): Promise<void> {
  const invitation = await db.missionInvitation.findUnique({ where: { id: invitationId }, include: { provider: true, event: true } });
  if (!invitation || invitation.provider.userId !== providerUserId) throw new NotFoundError("Proposition introuvable.");
  if (invitation.status !== "PENDING") throw new DomainError("Cette proposition n’est plus en attente.");
  if (invitation.expiresAt.getTime() < Date.now()) {
    await db.missionInvitation.update({ where: { id: invitationId }, data: { status: "EXPIRED" } });
    throw new DomainError("Cette proposition a expiré.");
  }
  await db.$transaction(async (tx) => {
    await tx.missionInvitation.update({ where: { id: invitationId }, data: { status: response, respondedAt: new Date(), responseNote: note ?? null } });
    await recordAudit(
      { actorId: providerUserId, actorRole: "PROVIDER", action: response === "ACCEPTED" ? "invitation.accepted" : "invitation.declined", entityType: "Event", entityId: invitation.eventId, summary: `${invitation.provider.displayName} a ${response === "ACCEPTED" ? "accepté" : "refusé"} la proposition` },
      tx,
    );
  });
  const settings = await getSettings();
  const env = getEnv();
  await sendMail(
    {
      to: settings.contactEmail,
      subject: `${invitation.provider.displayName} a ${response === "ACCEPTED" ? "accepté" : "refusé"} — ${invitation.event.reference}`,
      template: "invitation-response",
      heading: response === "ACCEPTED" ? "Disponibilité confirmée" : "Proposition refusée",
      paragraphs: [
        `${invitation.provider.displayName} a ${response === "ACCEPTED" ? "accepté" : "refusé"} la proposition de mission pour ${invitation.event.title}.`,
        note ? `Message : ${note}` : "Aucun message joint.",
        response === "ACCEPTED" ? "L’affectation reste à confirmer depuis la fiche de l’événement." : "",
      ].filter(Boolean),
      cta: { label: "Ouvrir l’événement", url: `${env.APP_URL}/admin/evenements/${invitation.eventId}` },
      entityType: "Event",
      entityId: invitation.eventId,
    },
    settings.brandName,
  );
}

export async function withdrawInvitation(invitationId: string, actor: SessionUser): Promise<void> {
  const invitation = await db.missionInvitation.findUnique({ where: { id: invitationId }, include: { assignment: true } });
  if (!invitation) throw new NotFoundError("Proposition introuvable.");
  if (invitation.assignment) throw new DomainError("Cette proposition a déjà donné lieu à une affectation.");
  await db.$transaction(async (tx) => {
    await tx.missionInvitation.update({ where: { id: invitationId }, data: { status: "WITHDRAWN" } });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "invitation.withdrawn", entityType: "Event", entityId: invitation.eventId }, tx);
  });
}
