import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { eventMembers, eventPermissions, events } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { EVENT_PERMISSIONS, requireGlobalPermission, type EventPermission } from "@/modules/authorization";
import { notify } from "@/modules/notifications/application/notification-service";
import { recordAudit } from "@/modules/admin/application/audit";
import { recordSecurityEvent } from "@/modules/admin/application/security-service";

/**
 * Break-glass: exceptional, time-boxed access of a super administrator to an
 * event (legal request, safety incident). Administrators normally have NO
 * access to event content, children data or messages.
 *
 * Mechanism: a temporary `collaborator` member titled "Assistance
 * exceptionnelle" with explicit grants that expire (≤ 4 h). The authorization
 * module ignores expired grants; `revokeExpiredBreakGlass()` (worker, daily or
 * hourly) then revokes the member row itself. The event owner is notified.
 */
export const BREAK_GLASS_TITLE = "Assistance exceptionnelle";
export const BREAK_GLASS_MAX_MINUTES = 240;

/** Permissions that may be granted this way; health data stays excluded unless explicitly asked. */
export const BREAK_GLASS_GRANTABLE: readonly EventPermission[] = ["event.view", "event.members.view", "event.guests.view", "event.documents.view", "event.channels.view_all", "children.view_roster", "children.view_sensitive", "children.view_access_logs"];

export type BreakGlassInput = { eventId: string; legalReason: string; grants: EventPermission[]; durationMinutes: number };

export async function grantBreakGlass(actor: Actor, input: BreakGlassInput, executor: DbExecutor = db): Promise<{ memberId: string; expiresAt: Date }> {
  requireGlobalPermission(actor, "admin.break_glass");
  if (input.legalReason.trim().length < 20) throw new ValidationError("Le motif juridique doit être détaillé (20 caractères minimum).");
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 5 || input.durationMinutes > BREAK_GLASS_MAX_MINUTES) throw new ValidationError(`Durée entre 5 et ${BREAK_GLASS_MAX_MINUTES} minutes.`);
  const grants = [...new Set(input.grants)].filter((g) => (EVENT_PERMISSIONS as readonly string[]).includes(g) && BREAK_GLASS_GRANTABLE.includes(g));
  if (grants.length === 0) throw new ValidationError("Choisissez au moins un droit.");
  if (!grants.includes("event.view")) grants.unshift("event.view");

  return executor.transaction(async (tx) => {
    const [ev] = await tx.select({ id: events.id, ownerUserId: events.ownerUserId, name: events.name }).from(events).where(and(eq(events.id, input.eventId), isNull(events.deletedAt))).limit(1);
    if (!ev) throw new NotFoundError("Évènement introuvable.");
    const [already] = await tx.select({ id: eventMembers.id }).from(eventMembers).where(and(eq(eventMembers.eventId, ev.id), eq(eventMembers.userId, actor.userId))).limit(1);
    if (already) throw new ConflictError("Vous êtes déjà membre de cet évènement.");
    const expiresAt = new Date(Date.now() + input.durationMinutes * 60_000);
    const [member] = await tx
      .insert(eventMembers)
      .values({ eventId: ev.id, userId: actor.userId, role: "collaborator", status: "active", title: BREAK_GLASS_TITLE, invitedByUserId: actor.userId, joinedAt: new Date() })
      .returning({ id: eventMembers.id });
    if (!member) throw new Error("member insert failed");
    // Deny what the collaborator role would grant by default beyond the explicit list.
    const collaboratorDefaults: EventPermission[] = ["event.tasks.manage", "event.channels.post"];
    await tx.insert(eventPermissions).values([
      ...grants.map((permission) => ({ eventId: ev.id, memberId: member.id, permission, effect: "allow" as const, grantedByUserId: actor.userId, expiresAt })),
      ...collaboratorDefaults.map((permission) => ({ eventId: ev.id, memberId: member.id, permission, effect: "deny" as const, grantedByUserId: actor.userId, expiresAt: null })),
    ]);
    await recordAudit(tx, { actorUserId: actor.userId, action: "admin.break_glass", resourceType: "event", resourceId: ev.id, eventId: ev.id, metadata: { memberId: member.id, grants, expiresAt: expiresAt.toISOString(), durationMinutes: input.durationMinutes }, reason: input.legalReason.trim() });
    await recordSecurityEvent({ type: "break_glass_granted", severity: "critical", userId: actor.userId, details: { eventId: ev.id, grants, expiresAt: expiresAt.toISOString() } }, tx);
    await notify(
      {
        userId: ev.ownerUserId,
        type: "permission_changed",
        title: "Accès exceptionnel de l'équipe Sous Nos Ailes",
        body: `Un membre de l'équipe a obtenu un accès temporaire (jusqu'au ${expiresAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}) à votre évènement « ${ev.name} » dans le cadre d'une demande légale ou de sécurité. Cet accès est journalisé.`,
        href: `/app/evenements/${ev.id}/equipe`,
        eventId: ev.id,
        email: "always",
      },
      tx,
    );
    return { memberId: member.id, expiresAt };
  });
}

/** Revokes break-glass members whose grants have all expired. Call from the worker (retention/hourly). */
export async function revokeExpiredBreakGlass(executor: DbExecutor = db): Promise<{ revoked: number }> {
  const now = new Date();
  const candidates = await executor
    .select({ id: eventMembers.id, eventId: eventMembers.eventId, userId: eventMembers.userId })
    .from(eventMembers)
    .where(and(eq(eventMembers.title, BREAK_GLASS_TITLE), eq(eventMembers.status, "active"), eq(eventMembers.role, "collaborator")));
  let revoked = 0;
  for (const m of candidates) {
    const [live] = await executor
      .select({ n: sql<number>`count(*)::int` })
      .from(eventPermissions)
      .where(and(eq(eventPermissions.memberId, m.id), eq(eventPermissions.effect, "allow"), sql`${eventPermissions.expiresAt} is null or ${eventPermissions.expiresAt} > ${now}`));
    if ((live?.n ?? 0) > 0) continue;
    await executor.update(eventMembers).set({ status: "revoked", revokedAt: now }).where(eq(eventMembers.id, m.id));
    await executor.delete(eventPermissions).where(and(eq(eventPermissions.memberId, m.id), lt(eventPermissions.expiresAt, now)));
    await recordAudit(executor, { actorUserId: null, action: "admin.break_glass.expired", resourceType: "event", resourceId: m.eventId, eventId: m.eventId, metadata: { memberId: m.id, userId: m.userId } });
    revoked += 1;
  }
  return { revoked };
}

export async function listBreakGlassGrants(actor: Actor) {
  requireGlobalPermission(actor, "admin.security.view");
  return db
    .select({ memberId: eventMembers.id, eventId: eventMembers.eventId, eventName: events.name, userId: eventMembers.userId, status: eventMembers.status, joinedAt: eventMembers.joinedAt, revokedAt: eventMembers.revokedAt, expiresAt: sql<Date | null>`(select max(${eventPermissions.expiresAt}) from ${eventPermissions} where ${eventPermissions.memberId} = ${eventMembers.id})` })
    .from(eventMembers)
    .innerJoin(events, eq(events.id, eventMembers.eventId))
    .where(eq(eventMembers.title, BREAK_GLASS_TITLE))
    .orderBy(sql`${eventMembers.createdAt} desc`)
    .limit(100);
}

/** Immediate manual revocation. */
export async function revokeBreakGlass(actor: Actor, memberId: string, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(actor, "admin.break_glass");
  const [m] = await executor.select({ id: eventMembers.id, eventId: eventMembers.eventId }).from(eventMembers).where(and(eq(eventMembers.id, memberId), eq(eventMembers.title, BREAK_GLASS_TITLE))).limit(1);
  if (!m) throw new NotFoundError();
  await executor.update(eventMembers).set({ status: "revoked", revokedAt: new Date() }).where(eq(eventMembers.id, m.id));
  await executor.delete(eventPermissions).where(eq(eventPermissions.memberId, m.id));
  await recordAudit(executor, { actorUserId: actor.userId, action: "admin.break_glass.revoked", resourceType: "event", resourceId: m.eventId, eventId: m.eventId, metadata: { memberId } });
}
