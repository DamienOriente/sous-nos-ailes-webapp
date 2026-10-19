import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import {
  channelMembers,
  eventBudgetLines,
  eventChannels,
  eventMembers,
  eventProfessionals,
  events,
  invitationTokens,
  invitations,
  professionalCategories,
  professionals,
  users,
} from "@/db/schema";
import { hashToken, randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { EVENT_ROLE_LABELS, requireEventPermission } from "@/modules/authorization";
import { recordAudit } from "@/modules/events/application/audit";
import { zonedDateTimeToUtc } from "@/modules/events/application/event-service";
import { ASSIGNABLE_ROLES, canTransitionProvider, PROVIDER_STATUSES, type ProviderStatus } from "@/modules/events/domain/providers";
import { enqueueEmail } from "@/modules/notifications/application/email-outbox";
import { notify } from "@/modules/notifications/application/notification-service";

export const INVITATION_TTL_DAYS = 14;

export type ProviderRow = {
  id: string;
  eventId: string;
  status: ProviderStatus;
  professionalId: string | null;
  memberId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  displayName: string;
  proSlug: string | null;
  isExternal: boolean;
  externalEmail: string | null;
  externalPhone: string | null;
  quoteCents: number | null;
  quoteFileId: string | null;
  contractFileId: string | null;
  serviceStartsAt: Date | null;
  serviceEndsAt: Date | null;
  notes: string | null;
  memberRole: string | null;
  memberStatus: string | null;
  memberUserName: string | null;
  pendingInvitationId: string | null;
  pendingInvitationExpiresAt: Date | null;
  pendingInvitationEmail: string | null;
};

const baseSelect = (executor: DbExecutor) =>
  executor
    .select({
      id: eventProfessionals.id,
      eventId: eventProfessionals.eventId,
      status: eventProfessionals.status,
      professionalId: eventProfessionals.professionalId,
      memberId: eventProfessionals.memberId,
      categoryId: eventProfessionals.categoryId,
      categoryName: professionalCategories.name,
      categorySlug: professionalCategories.slug,
      externalName: eventProfessionals.externalName,
      externalEmail: eventProfessionals.externalEmail,
      externalPhone: eventProfessionals.externalPhone,
      proName: professionals.displayName,
      proSlug: professionals.slug,
      quoteCents: eventProfessionals.quoteCents,
      quoteFileId: eventProfessionals.quoteFileId,
      contractFileId: eventProfessionals.contractFileId,
      serviceStartsAt: eventProfessionals.serviceStartsAt,
      serviceEndsAt: eventProfessionals.serviceEndsAt,
      notes: eventProfessionals.notes,
      memberRole: eventMembers.role,
      memberStatus: eventMembers.status,
      memberUserName: users.name,
      pendingInvitationId: sql<string | null>`(select i.id from invitations i where i.event_professional_id = ${eventProfessionals.id} and i.status in ('sent','viewed') and (i.expires_at is null or i.expires_at > now()) order by i.created_at desc limit 1)`,
      pendingInvitationExpiresAt: sql<Date | null>`(select i.expires_at from invitations i where i.event_professional_id = ${eventProfessionals.id} and i.status in ('sent','viewed') and (i.expires_at is null or i.expires_at > now()) order by i.created_at desc limit 1)`,
      pendingInvitationEmail: sql<string | null>`(select i.recipient_email from invitations i where i.event_professional_id = ${eventProfessionals.id} and i.status in ('sent','viewed') and (i.expires_at is null or i.expires_at > now()) order by i.created_at desc limit 1)`,
    })
    .from(eventProfessionals)
    .leftJoin(professionalCategories, eq(professionalCategories.id, eventProfessionals.categoryId))
    .leftJoin(professionals, eq(professionals.id, eventProfessionals.professionalId))
    .leftJoin(eventMembers, eq(eventMembers.id, eventProfessionals.memberId))
    .leftJoin(users, eq(users.id, eventMembers.userId));

type BaseRow = Awaited<ReturnType<ReturnType<typeof baseSelect>["execute"]>>[number];

function toRow(r: BaseRow): ProviderRow {
  const expires = r.pendingInvitationExpiresAt ? new Date(r.pendingInvitationExpiresAt) : null;
  return {
    id: r.id,
    eventId: r.eventId,
    status: r.status,
    professionalId: r.professionalId,
    memberId: r.memberId,
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    categorySlug: r.categorySlug,
    displayName: r.proName ?? r.externalName ?? (r.categoryName ? `À trouver : ${r.categoryName}` : "Prestataire à définir"),
    proSlug: r.proSlug,
    isExternal: !r.professionalId,
    externalEmail: r.externalEmail,
    externalPhone: r.externalPhone,
    quoteCents: r.quoteCents,
    quoteFileId: r.quoteFileId,
    contractFileId: r.contractFileId,
    serviceStartsAt: r.serviceStartsAt,
    serviceEndsAt: r.serviceEndsAt,
    notes: r.notes,
    memberRole: r.memberRole,
    memberStatus: r.memberStatus,
    memberUserName: r.memberUserName,
    pendingInvitationId: r.pendingInvitationId,
    pendingInvitationExpiresAt: expires,
    pendingInvitationEmail: r.pendingInvitationEmail,
  };
}

/** Providers see the team list without contact details or quotes; organisers see everything. */
function redactForMember(row: ProviderRow, canManage: boolean): ProviderRow {
  if (canManage) return row;
  return { ...row, externalEmail: null, externalPhone: null, quoteCents: null, quoteFileId: null, contractFileId: null, notes: null, pendingInvitationEmail: null };
}

export async function listProviders(actor: Actor, eventId: string, executor: DbExecutor = db) {
  const access = await requireEventPermission(actor, eventId, "event.providers.view", executor);
  const canManage = access.permissions.has("event.providers.manage");
  const rows = await baseSelect(executor).where(eq(eventProfessionals.eventId, eventId)).orderBy(asc(professionalCategories.sortOrder), asc(eventProfessionals.createdAt));
  return { access, providers: rows.map((r) => redactForMember(toRow(r), canManage)) };
}

export async function getProvider(actor: Actor, eventId: string, providerId: string, executor: DbExecutor = db) {
  const access = await requireEventPermission(actor, eventId, "event.providers.view", executor);
  const [row] = await baseSelect(executor).where(and(eq(eventProfessionals.id, providerId), eq(eventProfessionals.eventId, eventId))).limit(1);
  if (!row) throw new NotFoundError();
  return { access, provider: redactForMember(toRow(row), access.permissions.has("event.providers.manage")) };
}

// ── Create / update ─────────────────────────────────────────────────────────
export const externalProviderSchema = z.object({
  externalName: z.string().trim().min(2, "Nom trop court.").max(160),
  externalEmail: z.email("E-mail invalide.").nullable().optional(),
  externalPhone: z.string().trim().max(30).nullable().optional(),
  categorySlug: z.string().trim().min(1, "Choisissez une catégorie."),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function createExternalProvider(actor: Actor, eventId: string, raw: unknown, executor: DbExecutor = db): Promise<{ id: string }> {
  await requireEventPermission(actor, eventId, "event.providers.manage", executor);
  const parsed = externalProviderSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Prestataire invalide.", { issues: parsed.error.issues });
  const [cat] = await executor.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, parsed.data.categorySlug)).limit(1);
  if (!cat) throw new ValidationError("Catégorie inconnue.");
  const [row] = await executor
    .insert(eventProfessionals)
    .values({ eventId, categoryId: cat.id, externalName: parsed.data.externalName, externalEmail: parsed.data.externalEmail ?? null, externalPhone: parsed.data.externalPhone ?? null, notes: parsed.data.notes ?? null, status: "shortlisted" })
    .returning({ id: eventProfessionals.id });
  if (!row) throw new Error("provider insert failed");
  return row;
}

/** Shortlist a platform professional (from the directory "add to my event" flow). Reuses an empty slot of the same category when one exists. */
export async function shortlistProfessional(actor: Actor, eventId: string, professionalId: string, executor: DbExecutor = db): Promise<{ id: string; created: boolean }> {
  await requireEventPermission(actor, eventId, "event.providers.manage", executor);
  const [pro] = await executor
    .select({ id: professionals.id, primaryCategoryId: professionals.primaryCategoryId, status: professionals.status })
    .from(professionals)
    .where(and(eq(professionals.id, professionalId), isNull(professionals.deletedAt)))
    .limit(1);
  if (!pro || pro.status !== "published") throw new NotFoundError();
  const [existing] = await executor.select({ id: eventProfessionals.id }).from(eventProfessionals).where(and(eq(eventProfessionals.eventId, eventId), eq(eventProfessionals.professionalId, professionalId))).limit(1);
  if (existing) return { id: existing.id, created: false };
  const [emptySlot] = await executor
    .select({ id: eventProfessionals.id })
    .from(eventProfessionals)
    .where(and(eq(eventProfessionals.eventId, eventId), eq(eventProfessionals.categoryId, pro.primaryCategoryId), isNull(eventProfessionals.professionalId), isNull(eventProfessionals.externalName), eq(eventProfessionals.status, "shortlisted")))
    .limit(1);
  if (emptySlot) {
    await executor.update(eventProfessionals).set({ professionalId }).where(eq(eventProfessionals.id, emptySlot.id));
    return { id: emptySlot.id, created: true };
  }
  const [row] = await executor.insert(eventProfessionals).values({ eventId, professionalId, categoryId: pro.primaryCategoryId, status: "shortlisted" }).returning({ id: eventProfessionals.id });
  if (!row) throw new Error("provider insert failed");
  return { id: row.id, created: true };
}

export const providerDetailsSchema = z.object({
  externalName: z.string().trim().min(2).max(160).nullable().optional(),
  externalEmail: z.email().nullable().optional(),
  externalPhone: z.string().trim().max(30).nullable().optional(),
  categorySlug: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  quoteCents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  quoteFileId: z.uuid().nullable().optional(),
  contractFileId: z.uuid().nullable().optional(),
  serviceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  serviceStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  serviceEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  budgetLineId: z.uuid().nullable().optional(),
});

export async function updateProvider(actor: Actor, eventId: string, providerId: string, raw: unknown, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.providers.manage", executor);
  const [current] = await executor.select().from(eventProfessionals).where(and(eq(eventProfessionals.id, providerId), eq(eventProfessionals.eventId, eventId))).limit(1);
  if (!current) throw new NotFoundError();
  const parsed = providerDetailsSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Données invalides.", { issues: parsed.error.issues });
  const d = parsed.data;
  const [ev] = await executor.select({ timezone: events.timezone, eventDate: events.eventDate }).from(events).where(eq(events.id, eventId)).limit(1);
  const tz = ev?.timezone ?? "Europe/Paris";
  let categoryId = current.categoryId;
  if (d.categorySlug) {
    const [cat] = await executor.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, d.categorySlug)).limit(1);
    if (!cat) throw new ValidationError("Catégorie inconnue.");
    categoryId = cat.id;
  }
  const date = d.serviceDate ?? ev?.eventDate ?? null;
  const serviceStartsAt = d.serviceStart !== undefined ? (d.serviceStart && date ? zonedDateTimeToUtc(date, d.serviceStart, tz) : null) : current.serviceStartsAt;
  let serviceEndsAt = d.serviceEnd !== undefined ? (d.serviceEnd && date ? zonedDateTimeToUtc(date, d.serviceEnd, tz) : null) : current.serviceEndsAt;
  if (serviceStartsAt && serviceEndsAt && serviceEndsAt <= serviceStartsAt) serviceEndsAt = new Date(serviceEndsAt.getTime() + 86_400_000);
  await executor
    .update(eventProfessionals)
    .set({
      externalName: current.professionalId ? current.externalName : d.externalName === undefined ? current.externalName : d.externalName,
      externalEmail: d.externalEmail === undefined ? current.externalEmail : d.externalEmail,
      externalPhone: d.externalPhone === undefined ? current.externalPhone : d.externalPhone,
      categoryId,
      notes: d.notes === undefined ? current.notes : d.notes,
      quoteCents: d.quoteCents === undefined ? current.quoteCents : d.quoteCents,
      quoteFileId: d.quoteFileId === undefined ? current.quoteFileId : d.quoteFileId,
      contractFileId: d.contractFileId === undefined ? current.contractFileId : d.contractFileId,
      serviceStartsAt,
      serviceEndsAt,
    })
    .where(eq(eventProfessionals.id, providerId));
  if (d.budgetLineId !== undefined) {
    // Link quote ↔ budget line (one line per provider at most).
    await executor.update(eventBudgetLines).set({ eventProfessionalId: null }).where(and(eq(eventBudgetLines.eventId, eventId), eq(eventBudgetLines.eventProfessionalId, providerId)));
    if (d.budgetLineId) {
      const [line] = await executor.select({ id: eventBudgetLines.id }).from(eventBudgetLines).where(and(eq(eventBudgetLines.id, d.budgetLineId), eq(eventBudgetLines.eventId, eventId))).limit(1);
      if (!line) throw new ValidationError("Ligne de budget inconnue.");
      await executor.update(eventBudgetLines).set({ eventProfessionalId: providerId }).where(eq(eventBudgetLines.id, d.budgetLineId));
    }
  }
}

export async function changeProviderStatus(actor: Actor, eventId: string, providerId: string, to: ProviderStatus, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.providers.manage", executor);
  if (!(PROVIDER_STATUSES as readonly string[]).includes(to)) throw new ValidationError("Statut inconnu.");
  const [current] = await executor.select().from(eventProfessionals).where(and(eq(eventProfessionals.id, providerId), eq(eventProfessionals.eventId, eventId))).limit(1);
  if (!current) throw new NotFoundError();
  if (!canTransitionProvider(current.status, to)) throw new ConflictError(`Transition impossible (${current.status} → ${to}).`);
  await executor.update(eventProfessionals).set({ status: to }).where(eq(eventProfessionals.id, providerId));
  await recordAudit({ actorUserId: actor.userId, action: "event.provider.status_changed", resourceType: "event_professional", resourceId: providerId, eventId, metadata: { from: current.status, to } }, executor);
  if (current.memberId) {
    const [m] = await executor.select({ userId: eventMembers.userId }).from(eventMembers).where(eq(eventMembers.id, current.memberId)).limit(1);
    if (m && m.userId !== actor.userId && (to === "confirmed" || to === "cancelled")) {
      await notify(
        { userId: m.userId, type: to === "confirmed" ? "quote_accepted" : "system", title: to === "confirmed" ? "Votre prestation est confirmée" : "Votre prestation a été annulée", href: `/app/evenements/${eventId}`, eventId, dedupeKey: `provider-status:${providerId}:${to}` },
        executor,
      );
    }
  }
}

export async function deleteProvider(actor: Actor, eventId: string, providerId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.providers.manage", executor);
  const [current] = await executor.select().from(eventProfessionals).where(and(eq(eventProfessionals.id, providerId), eq(eventProfessionals.eventId, eventId))).limit(1);
  if (!current) throw new NotFoundError();
  if (current.memberId) throw new ConflictError("Révoquez d'abord l'accès de ce prestataire à l'évènement.");
  await executor.delete(eventProfessionals).where(eq(eventProfessionals.id, providerId));
}

// ── Invitations (secure link) ───────────────────────────────────────────────
export const inviteSchema = z.object({
  email: z.email("E-mail invalide."),
  name: z.string().trim().min(2, "Nom trop court.").max(160),
  role: z.enum(ASSIGNABLE_ROLES),
  categorySlug: z.string().trim().min(1).nullable().optional(),
  message: z.string().trim().max(1500).nullable().optional(),
  /** Provider slot to link (null for a plain collaborator). */
  eventProfessionalId: z.uuid().nullable().optional(),
});
export type InviteInput = z.infer<typeof inviteSchema>;

export type InviteResult = { invitationId: string; expiresAt: Date };

/**
 * Creates the invitation + token (hash only in DB) and queues the e-mail that
 * carries the clear token. The token is never returned to the caller UI.
 */
export async function inviteMember(actor: Actor, eventId: string, raw: unknown, executor: DbExecutor = db): Promise<InviteResult> {
  const access = await requireEventPermission(actor, eventId, "event.members.manage", executor);
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Invitation invalide.", { issues: parsed.error.issues });
  const input = parsed.data;
  // Only owners / lead organisers can hand out organiser-level roles.
  if ((input.role === "co_organizer" || input.role === "lead_organizer" || input.role === "wedding_planner") && !access.permissions.has("event.permissions.manage")) {
    throw new ValidationError("Seul le propriétaire ou l'organisateur principal peut inviter avec ce rôle.");
  }
  const [ev] = await executor.select({ name: events.name }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!ev) throw new NotFoundError();
  if (input.eventProfessionalId) {
    const [slot] = await executor.select({ id: eventProfessionals.id, memberId: eventProfessionals.memberId }).from(eventProfessionals).where(and(eq(eventProfessionals.id, input.eventProfessionalId), eq(eventProfessionals.eventId, eventId))).limit(1);
    if (!slot) throw new NotFoundError();
    if (slot.memberId) throw new ConflictError("Ce prestataire a déjà rejoint l'évènement.");
    // Supersede previous pending invitations for this slot.
    await executor
      .update(invitations)
      .set({ status: "revoked" })
      .where(and(eq(invitations.eventProfessionalId, input.eventProfessionalId), eq(invitations.kind, "provider"), inArray(invitations.status, ["sent", "viewed"])));
  }
  const email = input.email.toLowerCase();
  const [already] = await executor
    .select({ id: eventMembers.id, status: eventMembers.status })
    .from(eventMembers)
    .innerJoin(users, eq(users.id, eventMembers.userId))
    .where(and(eq(eventMembers.eventId, eventId), eq(users.email, email), eq(eventMembers.status, "active")))
    .limit(1);
  if (already && !input.eventProfessionalId) throw new ConflictError("Cette personne fait déjà partie de l'équipe.");

  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000);
  const token = randomToken(32);
  const [inv] = await executor
    .insert(invitations)
    .values({
      eventId,
      kind: "provider",
      templateKey: "provider",
      recipientName: input.name,
      recipientEmail: email,
      customMessage: input.message ?? null,
      status: "sent",
      eventProfessionalId: input.eventProfessionalId ?? null,
      targetRole: input.categorySlug ? `${input.role}:${input.categorySlug}` : input.role,
      sentAt: new Date(),
      expiresAt,
      createdByUserId: actor.userId,
    })
    .returning({ id: invitations.id });
  if (!inv) throw new Error("invitation insert failed");
  await executor.insert(invitationTokens).values({ invitationId: inv.id, tokenHash: hashToken(token), purpose: "provider_join", expiresAt, maxUses: 1 });

  const url = new URL(`/app/invitations/${token}`, env.APP_URL).toString();
  await enqueueEmail(
    {
      toEmail: email,
      subject: `${actor.name} vous invite à rejoindre « ${ev.name} » sur Sous Nos Ailes`,
      templateKey: "invitation",
      payload: {
        heading: `Rejoindre l'équipe de « ${ev.name} »`,
        intro: `${actor.name} vous propose de rejoindre l'espace de coordination de cet évènement en tant que ${EVENT_ROLE_LABELS[input.role].toLowerCase()}. Ce lien est personnel et valable ${INVITATION_TTL_DAYS} jours.`,
        message: input.message ?? "",
        ctaLabel: "Accepter l'invitation",
        url,
      },
    },
    executor,
  );
  if (input.eventProfessionalId) {
    await executor.update(eventProfessionals).set({ status: sql`case when ${eventProfessionals.status} = 'shortlisted' then 'requested'::event_professional_status else ${eventProfessionals.status} end` }).where(eq(eventProfessionals.id, input.eventProfessionalId));
  }
  await recordAudit({ actorUserId: actor.userId, action: "event.invitation.sent", resourceType: "invitation", resourceId: inv.id, eventId, metadata: { role: input.role, eventProfessionalId: input.eventProfessionalId ?? null } }, executor);
  return { invitationId: inv.id, expiresAt };
}

export async function revokeInvitation(actor: Actor, eventId: string, invitationId: string, executor: DbExecutor = db): Promise<void> {
  await requireEventPermission(actor, eventId, "event.members.manage", executor);
  const [inv] = await executor.select({ id: invitations.id }).from(invitations).where(and(eq(invitations.id, invitationId), eq(invitations.eventId, eventId), eq(invitations.kind, "provider"))).limit(1);
  if (!inv) throw new NotFoundError();
  await executor.update(invitations).set({ status: "revoked" }).where(eq(invitations.id, invitationId));
  await executor.update(invitationTokens).set({ revokedAt: new Date() }).where(and(eq(invitationTokens.invitationId, invitationId), isNull(invitationTokens.revokedAt)));
  await recordAudit({ actorUserId: actor.userId, action: "event.invitation.revoked", resourceType: "invitation", resourceId: invitationId, eventId }, executor);
}

export async function listPendingInvitations(actor: Actor, eventId: string, executor: DbExecutor = db) {
  await requireEventPermission(actor, eventId, "event.members.view", executor);
  return executor
    .select({ id: invitations.id, recipientName: invitations.recipientName, recipientEmail: invitations.recipientEmail, targetRole: invitations.targetRole, status: invitations.status, sentAt: invitations.sentAt, expiresAt: invitations.expiresAt, eventProfessionalId: invitations.eventProfessionalId })
    .from(invitations)
    .where(and(eq(invitations.eventId, eventId), eq(invitations.kind, "provider"), inArray(invitations.status, ["sent", "viewed"])))
    .orderBy(desc(invitations.createdAt));
}

// ── Acceptance ──────────────────────────────────────────────────────────────
export type InvitationPreview = {
  invitationId: string;
  eventId: string;
  eventName: string;
  eventDate: string | null;
  city: string | null;
  role: string;
  roleLabel: string;
  categorySlug: string | null;
  inviterName: string | null;
  recipientEmail: string | null;
  state: "valid" | "expired" | "revoked" | "used";
};

function parseTargetRole(target: string | null): { role: (typeof ASSIGNABLE_ROLES)[number]; categorySlug: string | null } {
  const [role = "provider", slug] = (target ?? "provider").split(":");
  const safeRole = (ASSIGNABLE_ROLES as readonly string[]).includes(role) ? (role as (typeof ASSIGNABLE_ROLES)[number]) : "provider";
  return { role: safeRole, categorySlug: slug ?? null };
}

async function loadInvitationByToken(token: string, executor: DbExecutor) {
  if (!token || token.length < 16 || token.length > 128) return null;
  const [row] = await executor
    .select({ token: invitationTokens, invitation: invitations, eventName: events.name, eventDate: events.eventDate, city: events.city, eventDeletedAt: events.deletedAt, inviterName: users.name })
    .from(invitationTokens)
    .innerJoin(invitations, eq(invitations.id, invitationTokens.invitationId))
    .innerJoin(events, eq(events.id, invitations.eventId))
    .leftJoin(users, eq(users.id, invitations.createdByUserId))
    .where(and(eq(invitationTokens.tokenHash, hashToken(token)), eq(invitationTokens.purpose, "provider_join")))
    .limit(1);
  if (!row || row.eventDeletedAt) return null;
  return row;
}

export async function previewInvitation(token: string, executor: DbExecutor = db): Promise<InvitationPreview | null> {
  const row = await loadInvitationByToken(token, executor);
  if (!row) return null;
  const { role, categorySlug } = parseTargetRole(row.invitation.targetRole);
  const now = new Date();
  let state: InvitationPreview["state"] = "valid";
  if (row.token.revokedAt || row.invitation.status === "revoked") state = "revoked";
  else if (row.token.usedAt || row.token.useCount >= row.token.maxUses || row.invitation.status === "answered") state = "used";
  else if ((row.token.expiresAt && row.token.expiresAt < now) || (row.invitation.expiresAt && row.invitation.expiresAt < now)) state = "expired";
  return {
    invitationId: row.invitation.id,
    eventId: row.invitation.eventId,
    eventName: row.eventName,
    eventDate: row.eventDate,
    city: row.city,
    role,
    roleLabel: EVENT_ROLE_LABELS[role],
    categorySlug,
    inviterName: row.inviterName,
    recipientEmail: row.invitation.recipientEmail,
    state,
  };
}

/**
 * Accept a provider/collaborator invitation as the signed-in user. Creates or
 * reactivates the membership (one per user), links the provider slot, marks
 * the token used and notifies the organisers.
 */
export async function acceptInvitation(actor: Actor, token: string, executor: DbExecutor = db): Promise<{ eventId: string }> {
  const row = await loadInvitationByToken(token, executor);
  if (!row) throw new NotFoundError("Ce lien d'invitation est invalide.");
  const now = new Date();
  if (row.token.revokedAt || row.invitation.status === "revoked") throw new ConflictError("Cette invitation a été révoquée par l'organisateur.");
  if (row.token.usedAt || row.token.useCount >= row.token.maxUses || row.invitation.status === "answered") throw new ConflictError("Cette invitation a déjà été utilisée.");
  if ((row.token.expiresAt && row.token.expiresAt < now) || (row.invitation.expiresAt && row.invitation.expiresAt < now)) {
    await executor.update(invitations).set({ status: "expired" }).where(eq(invitations.id, row.invitation.id));
    throw new ConflictError("Cette invitation a expiré. Demandez un nouveau lien à l'organisateur.");
  }
  const eventId = row.invitation.eventId;
  const { role, categorySlug } = parseTargetRole(row.invitation.targetRole);

  const run = async (tx: DbExecutor) => {
    const [slot] = row.invitation.eventProfessionalId
      ? await tx.select().from(eventProfessionals).where(and(eq(eventProfessionals.id, row.invitation.eventProfessionalId), eq(eventProfessionals.eventId, eventId))).limit(1)
      : [undefined];
    let categoryId: string | null = slot?.categoryId ?? null;
    if (!categoryId && categorySlug) {
      const [cat] = await tx.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, categorySlug)).limit(1);
      categoryId = cat?.id ?? null;
    }
    // Professional listing of the user matching the slot (or any listing they own).
    const owned = await tx
      .select({ id: professionals.id, primaryCategoryId: professionals.primaryCategoryId })
      .from(professionals)
      .where(and(eq(professionals.ownerUserId, actor.userId), isNull(professionals.deletedAt), ne(professionals.status, "archived")))
      .orderBy(desc(professionals.publishedAt));
    const professionalId = slot?.professionalId ?? owned.find((p) => categoryId && p.primaryCategoryId === categoryId)?.id ?? (role === "provider" ? (owned[0]?.id ?? null) : null);
    if (!categoryId && professionalId) categoryId = owned.find((p) => p.id === professionalId)?.primaryCategoryId ?? null;

    const [existing] = await tx.select().from(eventMembers).where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, actor.userId))).limit(1);
    let memberId: string;
    if (existing) {
      memberId = existing.id;
      const keepRole = existing.status === "active" && existing.role === "owner";
      await tx
        .update(eventMembers)
        .set({
          status: "active",
          role: keepRole ? existing.role : role,
          categoryId: keepRole ? existing.categoryId : (categoryId ?? existing.categoryId),
          professionalId: professionalId ?? existing.professionalId,
          revokedAt: null,
          joinedAt: existing.joinedAt ?? now,
          invitedByUserId: row.invitation.createdByUserId ?? existing.invitedByUserId,
        })
        .where(eq(eventMembers.id, existing.id));
    } else {
      const [m] = await tx
        .insert(eventMembers)
        .values({ eventId, userId: actor.userId, role, status: "active", categoryId, professionalId, invitedByUserId: row.invitation.createdByUserId, joinedAt: now })
        .returning({ id: eventMembers.id });
      if (!m) throw new Error("member insert failed");
      memberId = m.id;
    }
    if (slot) {
      await tx
        .update(eventProfessionals)
        .set({ memberId, professionalId: slot.professionalId ?? professionalId, status: slot.status === "shortlisted" || slot.status === "requested" ? slot.status : slot.status })
        .where(eq(eventProfessionals.id, slot.id));
    }
    // Join open channels (read tracking).
    const open = await tx.select({ id: eventChannels.id }).from(eventChannels).where(and(eq(eventChannels.eventId, eventId), eq(eventChannels.isOpenToAllMembers, true), isNull(eventChannels.archivedAt)));
    for (const c of open) await tx.insert(channelMembers).values({ channelId: c.id, memberId }).onConflictDoNothing();

    await tx.update(invitationTokens).set({ usedAt: now, useCount: row.token.useCount + 1 }).where(eq(invitationTokens.id, row.token.id));
    await tx.update(invitations).set({ status: "answered", answeredAt: now, viewedAt: row.invitation.viewedAt ?? now }).where(eq(invitations.id, row.invitation.id));
    await recordAudit({ actorUserId: actor.userId, action: "event.member.joined", resourceType: "event_member", resourceId: memberId, eventId, metadata: { role, invitationId: row.invitation.id } }, tx);

    const organisers = await tx
      .select({ userId: eventMembers.userId })
      .from(eventMembers)
      .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.status, "active"), or(eq(eventMembers.role, "owner"), eq(eventMembers.role, "lead_organizer"), eq(eventMembers.userId, row.invitation.createdByUserId ?? ""))));
    for (const o of organisers) {
      if (o.userId === actor.userId) continue;
      await notify(
        { userId: o.userId, type: "invitation_accepted", title: `${actor.name} a rejoint « ${row.eventName} »`, body: `Rôle : ${EVENT_ROLE_LABELS[role]}.`, href: `/app/evenements/${eventId}/equipe`, eventId, dedupeKey: `joined:${eventId}:${actor.userId}` },
        tx,
      );
    }
    return { eventId };
  };
  return executor === db ? db.transaction((tx) => run(tx)) : run(executor);
}
