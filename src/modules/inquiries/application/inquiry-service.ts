import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { inquiries, inquiryEvents, professionals, users } from "@/db/schema";
import { env } from "@/lib/env";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { getEventAccess, requireEventPermission, requireProfessionalManage } from "@/modules/authorization";
import { enqueueEmail } from "@/modules/notifications/application/email-outbox";
import { notify } from "@/modules/notifications/application/notification-service";
import { canTransitionInquiry, INQUIRY_STATUS_LABELS, type InquiryStatus } from "@/modules/inquiries/domain/inquiry-status";
import type { PublicInquiryInput } from "@/modules/inquiries/domain/inquiry-schema";
import { isPublicListing } from "@/modules/directory/application/public-listing";

export type InquiryRow = typeof inquiries.$inferSelect;

// ── Public creation ─────────────────────────────────────────────────────────
/**
 * Creates an inquiry from the public page. The requester may be anonymous.
 * `eventId` is kept only when the requester is an organiser of that event.
 */
export async function createPublicInquiry(input: PublicInquiryInput, actor: Actor | null): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [pro] = await tx
      .select({ id: professionals.id, ownerUserId: professionals.ownerUserId, displayName: professionals.displayName, status: professionals.status, slug: professionals.slug, isDemo: professionals.isDemo })
      .from(professionals)
      .where(and(eq(professionals.id, input.professionalId), isPublicListing(), isNull(professionals.deletedAt)))
      .limit(1);
    if (!pro) throw new NotFoundError("Ce professionnel n'est pas disponible.");

    let eventId: string | null = null;
    if (input.eventId && actor) {
      const access = await getEventAccess(actor, input.eventId, tx);
      if (access?.isOrganizer) eventId = input.eventId;
    }

    const [row] = await tx
      .insert(inquiries)
      .values({
        professionalId: pro.id,
        requesterUserId: actor?.userId ?? null,
        eventId,
        kind: input.kind,
        status: "new",
        requesterName: input.requesterName,
        requesterEmail: input.requesterEmail.toLowerCase(),
        requesterPhone: input.requesterPhone || null,
        eventTypeLabel: input.eventTypeLabel || null,
        eventDate: input.eventDate || null,
        eventCity: input.eventCity || null,
        guestsCount: input.guestsCount ?? null,
        childrenCount: input.childrenCount ?? null,
        message: input.message,
        isDemo: Boolean(actor?.isDemo) || pro.isDemo,
      })
      .returning({ id: inquiries.id });
    if (!row) throw new Error("insert failed");
    await tx.insert(inquiryEvents).values({ inquiryId: row.id, actorUserId: actor?.userId ?? null, fromStatus: null, toStatus: "new", note: "Demande reçue depuis la page publique." });

    const href = `/app/pro/${pro.id}/demandes/${row.id}`;
    await notify(
      {
        userId: pro.ownerUserId,
        type: "inquiry_received",
        title: `Nouvelle demande de ${input.requesterName}`,
        body: input.eventTypeLabel ? `${input.eventTypeLabel}${input.eventDate ? ` · ${input.eventDate}` : ""}${input.eventCity ? ` · ${input.eventCity}` : ""}` : undefined,
        href,
        dedupeKey: `inquiry:${row.id}`,
      },
      tx,
    );
    // Confirmation to the requester: no third-party data, no message echo beyond what they wrote.
    await enqueueEmail(
      {
        toEmail: input.requesterEmail.toLowerCase(),
        subject: `Votre demande à ${pro.displayName} a bien été transmise`,
        templateKey: "inquiry",
        payload: {
          heading: "Demande transmise",
          intro: `Bonjour ${input.requesterName}, votre demande a été envoyée à ${pro.displayName} via Sous Nos Ailes. Le professionnel vous répondra directement à cette adresse.`,
          message: "Rappel de votre message : " + input.message.slice(0, 500),
          url: new URL(`/pro/${pro.slug}`, env.APP_URL).toString(),
          ctaLabel: "Revoir la fiche du professionnel",
        },
      },
      tx,
    );
    return { id: row.id };
  });
}

// ── Professional workspace ──────────────────────────────────────────────────
export async function listInquiriesForProfessional(actor: Actor, professionalId: string, status?: InquiryStatus | "all", executor: DbExecutor = db) {
  await requireProfessionalManage(actor, professionalId, executor);
  const where = status && status !== "all" ? and(eq(inquiries.professionalId, professionalId), eq(inquiries.status, status)) : eq(inquiries.professionalId, professionalId);
  return executor.select().from(inquiries).where(where).orderBy(desc(inquiries.createdAt)).limit(200);
}

export async function countInquiriesByStatus(actor: Actor, professionalId: string, executor: DbExecutor = db): Promise<Record<string, number>> {
  await requireProfessionalManage(actor, professionalId, executor);
  const rows = await executor.select({ status: inquiries.status, n: sql<number>`count(*)::int` }).from(inquiries).where(eq(inquiries.professionalId, professionalId)).groupBy(inquiries.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

/** Opens an inquiry; a `new` one becomes `viewed` (with an event). */
export async function getInquiryForProfessional(actor: Actor, professionalId: string, inquiryId: string) {
  await requireProfessionalManage(actor, professionalId);
  const [row] = await db.select().from(inquiries).where(and(eq(inquiries.id, inquiryId), eq(inquiries.professionalId, professionalId))).limit(1);
  if (!row) throw new NotFoundError();
  if (row.status === "new") {
    await db.update(inquiries).set({ status: "viewed" }).where(eq(inquiries.id, inquiryId));
    await db.insert(inquiryEvents).values({ inquiryId, actorUserId: actor.userId, fromStatus: "new", toStatus: "viewed", note: null });
    row.status = "viewed";
  }
  const history = await db.select().from(inquiryEvents).where(eq(inquiryEvents.inquiryId, inquiryId)).orderBy(desc(inquiryEvents.createdAt));
  return { inquiry: row, history };
}

async function loadForManage(actor: Actor, professionalId: string, inquiryId: string, executor: DbExecutor) {
  await requireProfessionalManage(actor, professionalId, executor);
  const [row] = await executor
    .select({ inquiry: inquiries, proName: professionals.displayName, proSlug: professionals.slug })
    .from(inquiries)
    .innerJoin(professionals, eq(professionals.id, inquiries.professionalId))
    .where(and(eq(inquiries.id, inquiryId), eq(inquiries.professionalId, professionalId)))
    .limit(1);
  if (!row) throw new NotFoundError();
  return row;
}

/** Sends an e-mail to the requester and optionally moves the status. */
export async function replyToInquiry(actor: Actor, professionalId: string, inquiryId: string, message: string, toStatus?: InquiryStatus): Promise<void> {
  await db.transaction(async (tx) => {
    const { inquiry, proName, proSlug } = await loadForManage(actor, professionalId, inquiryId, tx);
    if (toStatus && toStatus !== inquiry.status && !canTransitionInquiry(inquiry.status, toStatus)) throw new ConflictError(`Passage « ${INQUIRY_STATUS_LABELS[inquiry.status]} » → « ${INQUIRY_STATUS_LABELS[toStatus]} » impossible.`);
    const next = toStatus && toStatus !== inquiry.status ? toStatus : null;
    if (next) await tx.update(inquiries).set({ status: next }).where(eq(inquiries.id, inquiryId));
    await tx.insert(inquiryEvents).values({ inquiryId, actorUserId: actor.userId, fromStatus: next ? inquiry.status : null, toStatus: next, note: message.slice(0, 3000) });
    await enqueueEmail(
      {
        toEmail: inquiry.requesterEmail,
        subject: `${proName} vous répond au sujet de votre demande`,
        templateKey: "inquiry",
        payload: {
          heading: `Réponse de ${proName}`,
          intro: `Bonjour ${inquiry.requesterName},`,
          message,
          url: new URL(`/pro/${proSlug}`, env.APP_URL).toString(),
          ctaLabel: "Voir la fiche du professionnel",
        },
      },
      tx,
    );
    if (inquiry.requesterUserId) {
      await notify({ userId: inquiry.requesterUserId, type: "inquiry_updated", title: `${proName} a répondu à votre demande`, body: next ? `Statut : ${INQUIRY_STATUS_LABELS[next]}` : undefined, href: inquiry.eventId ? `/app/evenements/${inquiry.eventId}/prestataires` : `/pro/${proSlug}`, eventId: inquiry.eventId ?? undefined }, tx);
    }
  });
}

/** Status change without message (archive, decline, confirm…). */
export async function transitionInquiry(actor: Actor, professionalId: string, inquiryId: string, toStatus: InquiryStatus, note?: string): Promise<void> {
  await db.transaction(async (tx) => {
    const { inquiry, proName, proSlug } = await loadForManage(actor, professionalId, inquiryId, tx);
    if (!canTransitionInquiry(inquiry.status, toStatus)) throw new ConflictError(`Passage « ${INQUIRY_STATUS_LABELS[inquiry.status]} » → « ${INQUIRY_STATUS_LABELS[toStatus]} » impossible.`);
    await tx.update(inquiries).set({ status: toStatus }).where(eq(inquiries.id, inquiryId));
    await tx.insert(inquiryEvents).values({ inquiryId, actorUserId: actor.userId, fromStatus: inquiry.status, toStatus, note: note?.slice(0, 1000) ?? null });
    if (inquiry.requesterUserId && toStatus !== "archived" && toStatus !== "viewed") {
      await notify({ userId: inquiry.requesterUserId, type: toStatus === "accepted" ? "quote_accepted" : "inquiry_updated", title: `Votre demande à ${proName} : ${INQUIRY_STATUS_LABELS[toStatus]}`, href: inquiry.eventId ? `/app/evenements/${inquiry.eventId}/prestataires` : `/pro/${proSlug}`, eventId: inquiry.eventId ?? undefined }, tx);
    }
  });
}

/** Quote: amount + note (+ optional file uploaded with purpose "quote"), status → quoted, e-mail to the requester. */
export async function sendQuote(actor: Actor, professionalId: string, inquiryId: string, input: { quoteCents: number; quoteNote?: string; quoteFileId?: string | null; message?: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const { inquiry, proName, proSlug } = await loadForManage(actor, professionalId, inquiryId, tx);
    if (inquiry.status !== "quoted" && !canTransitionInquiry(inquiry.status, "quoted")) throw new ConflictError("Impossible d'envoyer un devis à ce stade.");
    if (input.quoteCents < 0) throw new ValidationError("Montant invalide.");
    await tx.update(inquiries).set({ status: "quoted", quoteCents: input.quoteCents, quoteNote: input.quoteNote || null, quoteFileId: input.quoteFileId ?? null }).where(eq(inquiries.id, inquiryId));
    await tx.insert(inquiryEvents).values({ inquiryId, actorUserId: actor.userId, fromStatus: inquiry.status === "quoted" ? null : inquiry.status, toStatus: inquiry.status === "quoted" ? null : "quoted", note: `Devis : ${(input.quoteCents / 100).toFixed(2)} €${input.quoteNote ? ` : ${input.quoteNote.slice(0, 500)}` : ""}` });
    const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(input.quoteCents / 100);
    await enqueueEmail(
      {
        toEmail: inquiry.requesterEmail,
        subject: `Devis de ${proName} : ${amount}`,
        templateKey: "inquiry",
        payload: {
          heading: `Devis de ${proName}`,
          intro: `Bonjour ${inquiry.requesterName}, ${proName} vous propose un devis de ${amount}.${input.quoteNote ? ` ${input.quoteNote}` : ""}`,
          message: input.message ?? "",
          url: inquiry.requesterUserId && inquiry.eventId ? new URL(`/app/evenements/${inquiry.eventId}/prestataires`, env.APP_URL).toString() : new URL(`/pro/${proSlug}`, env.APP_URL).toString(),
          ctaLabel: inquiry.requesterUserId && inquiry.eventId ? "Voir le devis dans mon évènement" : "Voir la fiche du professionnel",
        },
      },
      tx,
    );
    if (inquiry.requesterUserId) {
      await notify({ userId: inquiry.requesterUserId, type: "inquiry_updated", title: `Devis reçu de ${proName} : ${amount}`, href: inquiry.eventId ? `/app/evenements/${inquiry.eventId}/prestataires` : `/pro/${proSlug}`, eventId: inquiry.eventId ?? undefined }, tx);
    }
  });
}

// ── Organiser side (consumed by the events module) ──────────────────────────
export async function listInquiriesForRequester(userId: string, executor: DbExecutor = db) {
  return executor
    .select({ inquiry: inquiries, professionalName: professionals.displayName, professionalSlug: professionals.slug })
    .from(inquiries)
    .innerJoin(professionals, eq(professionals.id, inquiries.professionalId))
    .where(eq(inquiries.requesterUserId, userId))
    .orderBy(desc(inquiries.createdAt));
}

export async function listInquiriesForEvent(actor: Actor, eventId: string, executor: DbExecutor = db) {
  await requireEventPermission(actor, eventId, "event.inquiries.view", executor);
  return executor
    .select({ inquiry: inquiries, professionalName: professionals.displayName, professionalSlug: professionals.slug, requesterName: users.name })
    .from(inquiries)
    .innerJoin(professionals, eq(professionals.id, inquiries.professionalId))
    .leftJoin(users, eq(users.id, inquiries.requesterUserId))
    .where(eq(inquiries.eventId, eventId))
    .orderBy(desc(inquiries.createdAt));
}
