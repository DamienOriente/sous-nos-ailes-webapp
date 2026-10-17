import { and, asc, count, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { db, type DbExecutor } from "@/db/client";
import { eventGuests, events, guestGroups, invitationCheckins, invitationResponses, invitationTokens, invitations, users } from "@/db/schema";
import { decryptText, encryptText, hashToken, randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { ConflictError, NotFoundError, PaymentRequiredError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { getEffectivePlan, planFeatureLimit, planHasFeature } from "@/modules/billing/application/entitlements";
import { writeAudit } from "@/modules/guests/application/audit";
import { enqueueEmail } from "@/modules/notifications/application/email-outbox";
import { notify } from "@/modules/notifications/application/notification-service";
import { canSendReminder } from "@/modules/invitations/domain/reminders";
import { acceptsResponse, canTransition, computeRsvpExpiry, statusAfterAnswer, statusAfterView, type InvitationKind, type InvitationStatus } from "@/modules/invitations/domain/state";
import { isTemplateAllowed, type InvitationTemplateKey } from "@/modules/invitations/domain/templates";
import { CHECKIN_RESULT_LABELS, checkinUrl, evaluateToken, parseCheckinCode, rsvpUrl, type TokenOutcome } from "@/modules/invitations/domain/tokens";
import { enforceRateLimit } from "@/modules/invitations/infrastructure/rate-limit";

export type InvitationRecord = typeof invitations.$inferSelect;
export type InvitationTokenRecord = typeof invitationTokens.$inferSelect;
export type InvitationResponseRecord = typeof invitationResponses.$inferSelect;
export type CheckinRecord = typeof invitationCheckins.$inferSelect;

/** RSVP links are multi-use (the recipient may change their answer); QR codes are single-use. */
const RSVP_MAX_USES = 1000;

export type PublicEventInfo = { id: string; name: string; type: string; eventDate: string | null; startsAt: Date | null; timezone: string; venueName: string | null; city: string | null; ownerUserId: string };

async function loadEvent(eventId: string, executor: DbExecutor): Promise<PublicEventInfo> {
  const [e] = await executor
    .select({ id: events.id, name: events.name, type: events.type, eventDate: events.eventDate, startsAt: events.startsAt, timezone: events.timezone, venueName: events.venueName, city: events.city, ownerUserId: events.ownerUserId, deletedAt: events.deletedAt })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!e || e.deletedAt) throw new NotFoundError();
  return e;
}

// ── Entitlements ────────────────────────────────────────────────────────────
export type InvitationEntitlement = { premium: boolean; basicLimit: number | null; planName: string };

/** Premium features follow the event owner's plan (co-organisers and planners benefit from it). */
export async function getInvitationEntitlement(eventId: string, executor: DbExecutor = db): Promise<InvitationEntitlement> {
  const event = await loadEvent(eventId, executor);
  const plan = await getEffectivePlan(event.ownerUserId, "organizer", null, executor);
  return { premium: planHasFeature(plan, "invitations.premium"), basicLimit: planFeatureLimit(plan, "invitations.basic"), planName: plan.planName };
}

// ── Listing ─────────────────────────────────────────────────────────────────
export type InvitationListItem = InvitationRecord & { guestCount: number; hasCheckinToken: boolean; responseCount: number };

async function expireOverdue(eventId: string, executor: DbExecutor): Promise<void> {
  await executor
    .update(invitations)
    .set({ status: "expired" })
    .where(and(eq(invitations.eventId, eventId), inArray(invitations.status, ["draft", "sent", "viewed"]), lt(invitations.expiresAt, new Date())));
}

export async function listInvitations(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<InvitationListItem[]> {
  await requireEventPermission(actor, eventId, "event.invitations.manage", executor);
  await expireOverdue(eventId, executor);
  const rows = await executor
    .select({
      inv: invitations,
      hasCheckinToken: sql<boolean>`exists (select 1 from ${invitationTokens} t where t.invitation_id = ${invitations.id} and t.purpose = 'checkin' and t.revoked_at is null)`,
      responseCount: sql<number>`(select count(*)::int from ${invitationResponses} r where r.invitation_id = ${invitations.id})`,
    })
    .from(invitations)
    .where(eq(invitations.eventId, eventId))
    .orderBy(desc(invitations.createdAt));
  return rows.map((r) => ({ ...r.inv, guestCount: r.inv.guestIds.length, hasCheckinToken: r.hasCheckinToken, responseCount: r.responseCount }));
}

export type InvitationStats = Record<InvitationStatus, number> & { total: number };

export async function getInvitationStats(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<InvitationStats> {
  await requireEventPermission(actor, eventId, "event.invitations.manage", executor);
  const rows = await executor.select({ status: invitations.status, n: count() }).from(invitations).where(eq(invitations.eventId, eventId)).groupBy(invitations.status);
  const stats: InvitationStats = { draft: 0, sent: 0, viewed: 0, answered: 0, revoked: 0, expired: 0, total: 0 };
  for (const r of rows) {
    stats[r.status] = r.n;
    stats.total += r.n;
  }
  return stats;
}

// ── Create / update ─────────────────────────────────────────────────────────
export type InvitationInput = {
  kind: InvitationKind;
  templateKey: string;
  recipientName: string;
  recipientEmail?: string | null;
  customMessage?: string | null;
  guestIds?: string[];
  groupId?: string | null;
  showDate?: boolean;
  showVenue?: boolean;
};

async function resolveGuestIds(eventId: string, input: InvitationInput, executor: DbExecutor): Promise<string[]> {
  if (input.kind === "group") {
    if (!input.groupId) throw new ValidationError("Choisissez un groupe d'invités.");
    const [g] = await executor.select({ id: guestGroups.id }).from(guestGroups).where(and(eq(guestGroups.id, input.groupId), eq(guestGroups.eventId, eventId))).limit(1);
    if (!g) throw new ValidationError("Groupe inconnu pour cet évènement.");
    const rows = await executor.select({ id: eventGuests.id }).from(eventGuests).where(and(eq(eventGuests.eventId, eventId), eq(eventGuests.groupId, input.groupId)));
    if (rows.length === 0) throw new ValidationError("Ce groupe ne contient aucun invité.");
    return rows.map((r) => r.id);
  }
  const ids = Array.from(new Set(input.guestIds ?? []));
  if (input.kind === "family" && ids.length === 0) throw new ValidationError("Une invitation familiale couvre au moins un invité.");
  if (input.kind === "individual" && ids.length > 1) throw new ValidationError("Une invitation individuelle ne couvre qu'un seul invité.");
  if (ids.length > 0) {
    const rows = await executor.select({ id: eventGuests.id }).from(eventGuests).where(and(eq(eventGuests.eventId, eventId), inArray(eventGuests.id, ids)));
    // Isolation: guest ids from another event are rejected, never silently accepted.
    if (rows.length !== ids.length) throw new ValidationError("Certains invités n'appartiennent pas à cet évènement.");
  }
  return ids;
}

function validateCommon(input: InvitationInput, entitlement: InvitationEntitlement) {
  const recipientName = input.recipientName.trim();
  if (!recipientName) throw new ValidationError("Le nom du destinataire est requis.");
  if (!isTemplateAllowed(input.templateKey, entitlement.premium)) {
    if (!entitlement.premium) throw new PaymentRequiredError("Les modèles personnalisés font partie de l'offre Organisateur Plus.");
    throw new ValidationError("Modèle d'invitation inconnu.");
  }
  const recipientEmail = input.recipientEmail?.trim().toLowerCase() || null;
  if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) throw new ValidationError("Adresse e-mail invalide.");
  if (!entitlement.premium && input.customMessage && input.customMessage.length > 500) throw new ValidationError("Le message est limité à 500 caractères.");
  return { recipientName, recipientEmail, templateKey: input.templateKey as InvitationTemplateKey, customMessage: input.customMessage?.trim().slice(0, 2000) || null, displayOptions: { showDate: input.showDate ?? true, showVenue: input.showVenue ?? true } };
}

async function createToken(invitationId: string, purpose: "rsvp" | "checkin", expiresAt: Date | null, maxUses: number, executor: DbExecutor): Promise<{ id: string; token: string }> {
  const token = randomToken(32);
  const [row] = await executor
    .insert(invitationTokens)
    .values({ invitationId, purpose, tokenHash: hashToken(token), tokenEncrypted: encryptText(token), expiresAt, maxUses })
    .returning({ id: invitationTokens.id });
  return { id: row!.id, token };
}

async function activeToken(invitationId: string, purpose: "rsvp" | "checkin", executor: DbExecutor): Promise<InvitationTokenRecord | null> {
  const [row] = await executor
    .select()
    .from(invitationTokens)
    .where(and(eq(invitationTokens.invitationId, invitationId), eq(invitationTokens.purpose, purpose), isNull(invitationTokens.revokedAt)))
    .orderBy(desc(invitationTokens.createdAt))
    .limit(1);
  return row ?? null;
}

function clearToken(row: InvitationTokenRecord): string | null {
  if (!row.tokenEncrypted) return null;
  try {
    return decryptText(row.tokenEncrypted);
  } catch {
    return null;
  }
}

export async function createInvitation(actor: Actor, eventId: string, input: InvitationInput): Promise<InvitationRecord> {
  return db.transaction(async (tx) => {
    await requireEventPermission(actor, eventId, "event.invitations.manage", tx);
    const event = await loadEvent(eventId, tx);
    const entitlement = await getInvitationEntitlement(eventId, tx);
    if (!entitlement.premium && entitlement.basicLimit !== null) {
      const [row] = await tx.select({ n: count() }).from(invitations).where(and(eq(invitations.eventId, eventId), sql`${invitations.status} <> 'revoked'`));
      if ((row?.n ?? 0) >= entitlement.basicLimit) {
        throw new PaymentRequiredError(`Votre offre ${entitlement.planName} est limitée à ${entitlement.basicLimit} invitations par évènement. Passez à Organisateur Plus pour continuer.`);
      }
    }
    const common = validateCommon(input, entitlement);
    const guestIds = await resolveGuestIds(eventId, input, tx);
    const expiresAt = computeRsvpExpiry(event.eventDate);
    const [row] = await tx
      .insert(invitations)
      .values({ eventId, kind: input.kind, ...common, guestIds, expiresAt, createdByUserId: actor.userId })
      .returning();
    if (!row) throw new Error("insert failed");
    await createToken(row.id, "rsvp", expiresAt, RSVP_MAX_USES, tx);
    return row;
  });
}

export async function updateInvitation(actor: Actor, eventId: string, invitationId: string, input: Omit<InvitationInput, "kind" | "guestIds" | "groupId">): Promise<InvitationRecord> {
  return db.transaction(async (tx) => {
    await requireEventPermission(actor, eventId, "event.invitations.manage", tx);
    const existing = await getInvitation(actor, eventId, invitationId, tx);
    if (existing.status === "revoked" || existing.status === "expired") throw new ConflictError("Une invitation révoquée ou expirée ne peut plus être modifiée.");
    const entitlement = await getInvitationEntitlement(eventId, tx);
    const common = validateCommon({ ...input, kind: existing.kind as InvitationKind }, entitlement);
    const [row] = await tx.update(invitations).set(common).where(eq(invitations.id, invitationId)).returning();
    if (!row) throw new NotFoundError();
    return row;
  });
}

export async function getInvitation(actor: Actor, eventId: string, invitationId: string, executor: DbExecutor = db): Promise<InvitationRecord> {
  await requireEventPermission(actor, eventId, "event.invitations.manage", executor);
  const [row] = await executor.select().from(invitations).where(and(eq(invitations.id, invitationId), eq(invitations.eventId, eventId))).limit(1);
  if (!row) throw new NotFoundError();
  return row;
}

export type InvitationDetail = {
  invitation: InvitationRecord;
  event: PublicEventInfo;
  guests: Array<{ id: string; firstName: string; lastName: string; isChild: boolean; rsvpStatus: string; rsvpGuestsCount: number | null; plusOnesAllowed: number }>;
  rsvpLink: string | null;
  hasCheckinToken: boolean;
  responses: InvitationResponseRecord[];
  checkins: CheckinRecord[];
  entitlement: InvitationEntitlement;
};

export async function getInvitationDetail(actor: Actor, eventId: string, invitationId: string, executor: DbExecutor = db): Promise<InvitationDetail> {
  const invitation = await getInvitation(actor, eventId, invitationId, executor);
  const event = await loadEvent(eventId, executor);
  const guests =
    invitation.guestIds.length > 0
      ? await executor
          .select({ id: eventGuests.id, firstName: eventGuests.firstName, lastName: eventGuests.lastName, isChild: eventGuests.isChild, rsvpStatus: eventGuests.rsvpStatus, rsvpGuestsCount: eventGuests.rsvpGuestsCount, plusOnesAllowed: eventGuests.plusOnesAllowed })
          .from(eventGuests)
          .where(and(eq(eventGuests.eventId, eventId), inArray(eventGuests.id, invitation.guestIds)))
      : [];
  const rsvp = await activeToken(invitationId, "rsvp", executor);
  const clear = rsvp ? clearToken(rsvp) : null;
  const checkin = await activeToken(invitationId, "checkin", executor);
  const responses = await executor.select().from(invitationResponses).where(eq(invitationResponses.invitationId, invitationId)).orderBy(desc(invitationResponses.createdAt));
  const checkins = await executor.select().from(invitationCheckins).where(eq(invitationCheckins.invitationId, invitationId)).orderBy(desc(invitationCheckins.scannedAt));
  const entitlement = await getInvitationEntitlement(eventId, executor);
  return { invitation, event, guests, rsvpLink: clear && invitation.status !== "revoked" ? rsvpUrl(env.APP_URL, clear) : null, hasCheckinToken: Boolean(checkin), responses, checkins, entitlement };
}

// ── Send / remind / revoke / delete ─────────────────────────────────────────
async function ensureRsvpLink(invitation: InvitationRecord, executor: DbExecutor): Promise<string> {
  const existing = await activeToken(invitation.id, "rsvp", executor);
  const clear = existing ? clearToken(existing) : null;
  if (clear) return rsvpUrl(env.APP_URL, clear);
  const created = await createToken(invitation.id, "rsvp", invitation.expiresAt, RSVP_MAX_USES, executor);
  return rsvpUrl(env.APP_URL, created.token);
}

function invitationEmailPayload(event: PublicEventInfo, invitation: InvitationRecord, url: string, reminder: boolean) {
  const intro = reminder
    ? `Petit rappel : vous êtes invité(e) à « ${event.name} ». L'organisateur attend votre réponse.`
    : `Vous êtes invité(e) à « ${event.name} ». Répondez en quelques secondes via le lien ci-dessous.`;
  return {
    toEmail: invitation.recipientEmail!,
    templateKey: "invitation",
    subject: reminder ? `Rappel — invitation : ${event.name}` : `Invitation : ${event.name}`,
    payload: { heading: `${invitation.recipientName}, vous êtes invité(e)`, intro, message: invitation.customMessage ?? "", ctaLabel: "Répondre à l'invitation", url },
  };
}

export async function sendInvitation(actor: Actor, eventId: string, invitationId: string): Promise<InvitationRecord> {
  return db.transaction(async (tx) => {
    const invitation = await getInvitation(actor, eventId, invitationId, tx);
    if (!invitation.recipientEmail) throw new ValidationError("Ajoutez une adresse e-mail au destinataire ou partagez le lien manuellement.");
    if (!canTransition(invitation.status, "sent")) throw new ConflictError("Cette invitation a déjà été envoyée. Utilisez la relance.");
    const event = await loadEvent(eventId, tx);
    const url = await ensureRsvpLink(invitation, tx);
    await enqueueEmail(invitationEmailPayload(event, invitation, url, false), tx);
    const [row] = await tx.update(invitations).set({ status: "sent", sentAt: new Date() }).where(eq(invitations.id, invitationId)).returning();
    return row!;
  });
}

export async function remindInvitation(actor: Actor, eventId: string, invitationId: string, now = new Date()): Promise<InvitationRecord> {
  return db.transaction(async (tx) => {
    const invitation = await getInvitation(actor, eventId, invitationId, tx);
    const decision = canSendReminder({ status: invitation.status, reminderCount: invitation.reminderCount, lastReminderAt: invitation.lastReminderAt, sentAt: invitation.sentAt, recipientEmail: invitation.recipientEmail, now });
    if (!decision.ok) {
      const messages: Record<string, string> = {
        no_email: "Aucune adresse e-mail pour ce destinataire.",
        status: "Seules les invitations envoyées et sans réponse peuvent être relancées.",
        max_reached: "Nombre maximal de relances atteint (2).",
        too_soon: `Relance possible à partir du ${decision.retryAfter?.toLocaleDateString("fr-FR") ?? "— "}.`,
      };
      throw new ConflictError(messages[decision.reason]);
    }
    const event = await loadEvent(eventId, tx);
    const url = await ensureRsvpLink(invitation, tx);
    await enqueueEmail(invitationEmailPayload(event, invitation, url, true), tx);
    const [row] = await tx
      .update(invitations)
      .set({ reminderCount: invitation.reminderCount + 1, lastReminderAt: now })
      .where(eq(invitations.id, invitationId))
      .returning();
    return row!;
  });
}

/** Revokes the invitation and every token (RSVP link and QR code become unusable). */
export async function revokeInvitation(actor: Actor, eventId: string, invitationId: string, reason?: string): Promise<InvitationRecord> {
  return db.transaction(async (tx) => {
    const invitation = await getInvitation(actor, eventId, invitationId, tx);
    if (invitation.status === "revoked") throw new ConflictError("Invitation déjà révoquée.");
    const now = new Date();
    await tx.update(invitationTokens).set({ revokedAt: now }).where(and(eq(invitationTokens.invitationId, invitationId), isNull(invitationTokens.revokedAt)));
    const [row] = await tx.update(invitations).set({ status: "revoked" }).where(eq(invitations.id, invitationId)).returning();
    await writeAudit(actor, { action: "invitation.revoked", resourceType: "invitation", resourceId: invitationId, eventId, reason: reason ?? null, metadata: { previousStatus: invitation.status } }, tx);
    return row!;
  });
}

export async function deleteInvitation(actor: Actor, eventId: string, invitationId: string): Promise<void> {
  return db.transaction(async (tx) => {
    const invitation = await getInvitation(actor, eventId, invitationId, tx);
    await tx.delete(invitations).where(eq(invitations.id, invitationId));
    await writeAudit(actor, { action: "invitation.deleted", resourceType: "invitation", resourceId: invitationId, eventId, metadata: { status: invitation.status, kind: invitation.kind } }, tx);
  });
}

export async function getRsvpLink(actor: Actor, eventId: string, invitationId: string): Promise<string> {
  return db.transaction(async (tx) => {
    const invitation = await getInvitation(actor, eventId, invitationId, tx);
    if (invitation.status === "revoked" || invitation.status === "expired") throw new ConflictError("Cette invitation n'a plus de lien actif.");
    return ensureRsvpLink(invitation, tx);
  });
}

// ── QR code (check-in token) ────────────────────────────────────────────────
export type QrPayload = { url: string; pngDataUrl: string; svg: string; regenerated: boolean };

async function renderQr(url: string): Promise<{ pngDataUrl: string; svg: string }> {
  const pngDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 512, color: { dark: "#2f3437", light: "#ffffff" } });
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
  return { pngDataUrl, svg };
}

/**
 * Returns the invitation's QR code (single-use check-in token). The QR encodes
 * `${APP_URL}/c/<token>` only — no personal data. `regenerate` revokes the
 * previous token (a printed code becomes invalid).
 */
export async function getOrCreateCheckinQr(actor: Actor, eventId: string, invitationId: string, options: { regenerate?: boolean } = {}): Promise<QrPayload> {
  return db.transaction(async (tx) => {
    const invitation = await getInvitation(actor, eventId, invitationId, tx);
    if (invitation.status === "revoked" || invitation.status === "expired") throw new ConflictError("Impossible de générer un QR code pour une invitation révoquée ou expirée.");
    const entitlement = await getInvitationEntitlement(eventId, tx);
    if (!entitlement.premium) throw new PaymentRequiredError("Les QR codes d'accès font partie de l'offre Organisateur Plus.");
    const existing = await activeToken(invitationId, "checkin", tx);
    let regenerated = false;
    let token: string | null = null;
    if (existing && !options.regenerate) token = clearToken(existing);
    if (!token) {
      if (existing) {
        await tx.update(invitationTokens).set({ revokedAt: new Date() }).where(eq(invitationTokens.id, existing.id));
        regenerated = true;
        await writeAudit(actor, { action: "invitation.qr_regenerated", resourceType: "invitation", resourceId: invitationId, eventId }, tx);
      }
      const created = await createToken(invitationId, "checkin", invitation.expiresAt, 1, tx);
      token = created.token;
    }
    const url = checkinUrl(env.APP_URL, token);
    return { url, regenerated, ...(await renderQr(url)) };
  });
}

// ── Public RSVP ─────────────────────────────────────────────────────────────
export type PublicInvitationView = {
  outcome: TokenOutcome;
  invitation: Pick<InvitationRecord, "id" | "kind" | "templateKey" | "recipientName" | "customMessage" | "displayOptions" | "status" | "answeredAt"> | null;
  event: Pick<PublicEventInfo, "name" | "type" | "eventDate" | "startsAt" | "timezone" | "venueName" | "city"> | null;
  guests: Array<{ id: string; firstName: string; lastName: string; isChild: boolean; rsvpStatus: string; rsvpGuestsCount: number | null; plusOnesAllowed: number }>;
  lastResponse: Pick<InvitationResponseRecord, "status" | "guestsCount" | "message" | "perGuest"> | null;
};

async function findRsvpToken(token: string, executor: DbExecutor) {
  const [row] = await executor
    .select({ token: invitationTokens, invitation: invitations })
    .from(invitationTokens)
    .innerJoin(invitations, eq(invitations.id, invitationTokens.invitationId))
    .where(eq(invitationTokens.tokenHash, hashToken(token)))
    .limit(1);
  return row ?? null;
}

/** Resolves a public RSVP link. Marks the invitation as viewed on first open (no account required). */
export async function resolvePublicInvitation(token: string): Promise<PublicInvitationView> {
  const empty: PublicInvitationView = { outcome: "invalid", invitation: null, event: null, guests: [], lastResponse: null };
  if (!token || token.length > 200) return empty;
  const row = await findRsvpToken(token, db);
  if (!row) return empty;
  const { token: t, invitation } = row;
  const outcome = evaluateToken({ purpose: t.purpose, expiresAt: t.expiresAt, revokedAt: t.revokedAt, maxUses: t.maxUses, useCount: t.useCount, eventId: invitation.eventId, invitationStatus: invitation.status }, { purpose: "rsvp" });
  if (outcome === "invalid") return empty;
  const event = await loadEvent(invitation.eventId, db).catch(() => null);
  if (!event) return empty;
  if (outcome === "valid" && !invitation.viewedAt) {
    await db.update(invitations).set({ viewedAt: new Date(), status: statusAfterView(invitation.status) }).where(eq(invitations.id, invitation.id));
  }
  const guests =
    invitation.guestIds.length > 0
      ? await db
          .select({ id: eventGuests.id, firstName: eventGuests.firstName, lastName: eventGuests.lastName, isChild: eventGuests.isChild, rsvpStatus: eventGuests.rsvpStatus, rsvpGuestsCount: eventGuests.rsvpGuestsCount, plusOnesAllowed: eventGuests.plusOnesAllowed })
          .from(eventGuests)
          .where(and(eq(eventGuests.eventId, invitation.eventId), inArray(eventGuests.id, invitation.guestIds)))
      : [];
  const [last] = await db
    .select({ status: invitationResponses.status, guestsCount: invitationResponses.guestsCount, message: invitationResponses.message, perGuest: invitationResponses.perGuest })
    .from(invitationResponses)
    .where(eq(invitationResponses.invitationId, invitation.id))
    .orderBy(desc(invitationResponses.createdAt))
    .limit(1);
  return {
    outcome,
    invitation: { id: invitation.id, kind: invitation.kind, templateKey: invitation.templateKey, recipientName: invitation.recipientName, customMessage: invitation.customMessage, displayOptions: invitation.displayOptions, status: invitation.status, answeredAt: invitation.answeredAt },
    event: { name: event.name, type: event.type, eventDate: invitation.displayOptions.showDate ? event.eventDate : null, startsAt: invitation.displayOptions.showDate ? event.startsAt : null, timezone: event.timezone, venueName: invitation.displayOptions.showVenue ? event.venueName : null, city: invitation.displayOptions.showVenue ? event.city : null },
    guests,
    lastResponse: last ?? null,
  };
}

export type RsvpSubmission = { status: "accepted" | "declined" | "maybe"; guestsCount: number; message?: string | null; perGuest?: Record<string, "accepted" | "declined"> };

const RSVP_LABEL: Record<RsvpSubmission["status"], string> = { accepted: "Accepté", declined: "Refusé", maybe: "Peut-être" };

/**
 * Records a public answer: response row, guests' RSVP fields, invitation status,
 * token use count, organiser notification (deduplicated per invitation).
 */
export async function submitPublicRsvp(token: string, input: RsvpSubmission, ipAddress: string | null): Promise<{ ok: true }> {
  await enforceRateLimit(`rsvp:${ipAddress ?? "unknown"}`, 20, 600);
  return db.transaction(async (tx) => {
    const row = await findRsvpToken(token, tx);
    if (!row) throw new NotFoundError("Invitation introuvable ou lien invalide.");
    const { token: t, invitation } = row;
    const outcome = evaluateToken({ purpose: t.purpose, expiresAt: t.expiresAt, revokedAt: t.revokedAt, maxUses: t.maxUses, useCount: t.useCount, eventId: invitation.eventId, invitationStatus: invitation.status }, { purpose: "rsvp" });
    if (outcome === "revoked") throw new ConflictError("Cette invitation a été annulée par l'organisateur.");
    if (outcome === "expired") throw new ConflictError("Cette invitation a expiré.");
    if (outcome !== "valid" || !acceptsResponse(invitation.status)) throw new ConflictError("Cette invitation n'accepte plus de réponse.");
    const event = await loadEvent(invitation.eventId, tx);

    const guests = invitation.guestIds.length > 0 ? await tx.select().from(eventGuests).where(and(eq(eventGuests.eventId, invitation.eventId), inArray(eventGuests.id, invitation.guestIds))) : [];
    const allowedCompanions = guests.reduce((n, g) => n + g.plusOnesAllowed, 0);
    const baseCount = Math.max(1, guests.length);
    const guestsCount = Math.max(input.status === "declined" ? 0 : 1, Math.min(input.guestsCount, baseCount + allowedCompanions));
    const perGuest: Record<string, "accepted" | "declined"> = {};
    for (const g of guests) {
      const v = input.perGuest?.[g.id];
      perGuest[g.id] = v ?? (input.status === "declined" ? "declined" : "accepted");
    }
    const message = input.message?.trim().slice(0, 1000) || null;
    const now = new Date();

    await tx.insert(invitationResponses).values({ invitationId: invitation.id, status: input.status, guestsCount, message, perGuest, ipAddress });
    for (const g of guests) {
      const status = input.status === "maybe" ? "maybe" : perGuest[g.id] === "accepted" ? "accepted" : "declined";
      const share = status === "accepted" && guests.length > 0 ? Math.max(1, Math.round(guestsCount / Math.max(1, Object.values(perGuest).filter((v) => v === "accepted").length))) : null;
      await tx.update(eventGuests).set({ rsvpStatus: status, rsvpAnsweredAt: now, rsvpGuestsCount: share, rsvpMessage: message }).where(eq(eventGuests.id, g.id));
    }
    await tx.update(invitationTokens).set({ useCount: t.useCount + 1, usedAt: now }).where(eq(invitationTokens.id, t.id));
    await tx.update(invitations).set({ status: statusAfterAnswer(invitation.status), answeredAt: now }).where(eq(invitations.id, invitation.id));

    const recipients = new Set<string>([event.ownerUserId]);
    if (invitation.createdByUserId) recipients.add(invitation.createdByUserId);
    const title = `${invitation.recipientName} a répondu : ${RSVP_LABEL[input.status]}${input.status !== "declined" ? ` (${guestsCount} pers.)` : ""}`;
    for (const userId of recipients) {
      await notify(
        {
          userId,
          type: "rsvp_received",
          title,
          body: message ? "Un message accompagne la réponse." : undefined,
          href: `/app/evenements/${event.id}/invitations/${invitation.id}`,
          eventId: event.id,
          dedupeKey: `rsvp:${invitation.id}`,
        },
        tx,
      );
    }
    return { ok: true };
  });
}

// ── Check-in ────────────────────────────────────────────────────────────────
export type CheckinResult = "accepted" | "duplicate" | "revoked" | "expired" | "invalid";
export type CheckinOutcome = {
  result: CheckinResult;
  label: string;
  invitation: { id: string; recipientName: string; kind: string; expectedCount: number } | null;
  scannedAt: Date;
  previousScanAt: Date | null;
};

function expectedPersons(guests: Array<{ rsvpStatus: string; rsvpGuestsCount: number | null }>): number {
  if (guests.length === 0) return 1;
  return guests.reduce((n, g) => n + (g.rsvpStatus === "accepted" ? Math.max(1, g.rsvpGuestsCount ?? 1) : g.rsvpStatus === "declined" ? 0 : 1), 0);
}

/** Validates a scanned/typed code for `eventId`. A token from another event is "invalid" (never leaks its existence). */
export async function validateCheckin(actor: Actor, eventId: string, code: string): Promise<CheckinOutcome> {
  await requireEventPermission(actor, eventId, "event.invitations.checkin");
  const token = parseCheckinCode(code);
  const now = new Date();
  return db.transaction(async (tx) => {
    const row = token
      ? await tx
          .select({ token: invitationTokens, invitation: invitations })
          .from(invitationTokens)
          .innerJoin(invitations, eq(invitations.id, invitationTokens.invitationId))
          .where(eq(invitationTokens.tokenHash, hashToken(token)))
          .limit(1)
          .then((r) => r[0] ?? null)
      : null;
    const outcome = evaluateToken(
      row ? { purpose: row.token.purpose, expiresAt: row.token.expiresAt, revokedAt: row.token.revokedAt, maxUses: row.token.maxUses, useCount: row.token.useCount, eventId: row.invitation.eventId, invitationStatus: row.invitation.status } : null,
      { purpose: "checkin", eventId, now },
    );
    const belongs = row && row.invitation.eventId === eventId;
    const result: CheckinResult = outcome === "valid" ? "accepted" : outcome;
    let invitationInfo: CheckinOutcome["invitation"] = null;
    if (belongs) {
      const guests = row.invitation.guestIds.length > 0 ? await tx.select({ rsvpStatus: eventGuests.rsvpStatus, rsvpGuestsCount: eventGuests.rsvpGuestsCount }).from(eventGuests).where(inArray(eventGuests.id, row.invitation.guestIds)) : [];
      invitationInfo = { id: row.invitation.id, recipientName: row.invitation.recipientName, kind: row.invitation.kind, expectedCount: expectedPersons(guests) };
    }
    if (result === "accepted" && row) {
      await tx.update(invitationTokens).set({ useCount: row.token.useCount + 1, usedAt: now }).where(eq(invitationTokens.id, row.token.id));
    }
    await tx.insert(invitationCheckins).values({ eventId, invitationId: belongs ? row.invitation.id : null, tokenId: belongs ? row.token.id : null, result, scannedByUserId: actor.userId, scannedAt: now });
    return { result, label: CHECKIN_RESULT_LABELS[result], invitation: invitationInfo, scannedAt: now, previousScanAt: result === "duplicate" && belongs ? row.token.usedAt : null };
  });
}

export type CheckinHistoryItem = CheckinRecord & { recipientName: string | null; scannedByName: string | null };

export async function listCheckins(actor: Actor, eventId: string, limit = 100, executor: DbExecutor = db): Promise<CheckinHistoryItem[]> {
  await requireEventPermission(actor, eventId, "event.invitations.checkin", executor);
  const rows = await executor
    .select({ c: invitationCheckins, recipientName: invitations.recipientName, scannedByName: users.name })
    .from(invitationCheckins)
    .leftJoin(invitations, eq(invitations.id, invitationCheckins.invitationId))
    .leftJoin(users, eq(users.id, invitationCheckins.scannedByUserId))
    .where(eq(invitationCheckins.eventId, eventId))
    .orderBy(desc(invitationCheckins.scannedAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.c, recipientName: r.recipientName, scannedByName: r.scannedByName }));
}

export type CheckinStats = { accepted: number; duplicate: number; rejected: number; invitationsWithQr: number; presentPersons: number };

export async function getCheckinStats(actor: Actor, eventId: string, executor: DbExecutor = db): Promise<CheckinStats> {
  await requireEventPermission(actor, eventId, "event.invitations.checkin", executor);
  const rows = await executor.select({ result: invitationCheckins.result, n: count() }).from(invitationCheckins).where(eq(invitationCheckins.eventId, eventId)).groupBy(invitationCheckins.result);
  const stats: CheckinStats = { accepted: 0, duplicate: 0, rejected: 0, invitationsWithQr: 0, presentPersons: 0 };
  for (const r of rows) {
    if (r.result === "accepted") stats.accepted = r.n;
    else if (r.result === "duplicate") stats.duplicate = r.n;
    else stats.rejected += r.n;
  }
  const [qr] = await executor
    .select({ n: sql<number>`count(distinct ${invitationTokens.invitationId})::int` })
    .from(invitationTokens)
    .innerJoin(invitations, eq(invitations.id, invitationTokens.invitationId))
    .where(and(eq(invitations.eventId, eventId), eq(invitationTokens.purpose, "checkin"), isNull(invitationTokens.revokedAt)));
  stats.invitationsWithQr = qr?.n ?? 0;
  const accepted = await executor
    .select({ guestIds: invitations.guestIds })
    .from(invitationCheckins)
    .innerJoin(invitations, eq(invitations.id, invitationCheckins.invitationId))
    .where(and(eq(invitationCheckins.eventId, eventId), eq(invitationCheckins.result, "accepted")));
  const guestIds = Array.from(new Set(accepted.flatMap((a) => a.guestIds)));
  if (guestIds.length > 0) {
    const gs = await executor.select({ rsvpStatus: eventGuests.rsvpStatus, rsvpGuestsCount: eventGuests.rsvpGuestsCount }).from(eventGuests).where(inArray(eventGuests.id, guestIds));
    stats.presentPersons = expectedPersons(gs);
  } else {
    stats.presentPersons = accepted.length;
  }
  return stats;
}

export async function listInvitationGuestsOptions(actor: Actor, eventId: string, executor: DbExecutor = db) {
  await requireEventPermission(actor, eventId, "event.invitations.manage", executor);
  const guests = await executor
    .select({ id: eventGuests.id, firstName: eventGuests.firstName, lastName: eventGuests.lastName, email: eventGuests.email, groupId: eventGuests.groupId, isChild: eventGuests.isChild })
    .from(eventGuests)
    .where(eq(eventGuests.eventId, eventId))
    .orderBy(asc(eventGuests.lastName), asc(eventGuests.firstName));
  const groups = await executor.select({ id: guestGroups.id, name: guestGroups.name }).from(guestGroups).where(eq(guestGroups.eventId, eventId)).orderBy(asc(guestGroups.name));
  return { guests, groups };
}
