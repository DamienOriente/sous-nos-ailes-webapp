import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { events, inquiries, inquiryEvents, inquiryQuotes, professionalCategories, professionals, users } from "@/db/schema";
import { env } from "@/lib/env";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { getEventAccess, requireEventPermission, requireProfessionalManage } from "@/modules/authorization";
import { enqueueEmail } from "@/modules/notifications/application/email-outbox";
import { notify } from "@/modules/notifications/application/notification-service";
import { canTransitionInquiry, INQUIRY_STATUS_LABELS, type InquiryStatus } from "@/modules/inquiries/domain/inquiry-status";
import type { PublicInquiryInput } from "@/modules/inquiries/domain/inquiry-schema";
import { isPublicListing } from "@/modules/directory/application/public-listing";
import { recordAcceptedQuoteInBudget } from "@/modules/events/application/payment-service";
import { briefSummary, buildBrief, type EventBrief } from "@/modules/events/domain/brief";
import { compareQuotes, type CancellationPolicy, type ComparableQuote, type StructuredQuote } from "@/modules/inquiries/domain/quote";

export type InquiryRow = typeof inquiries.$inferSelect;

// ── Creation ────────────────────────────────────────────────────────────────
type PublicPro = { id: string; ownerUserId: string; displayName: string; slug: string; isDemo: boolean };

async function loadPublicPro(tx: DbExecutor, professionalId: string): Promise<PublicPro> {
  const [pro] = await tx
    .select({ id: professionals.id, ownerUserId: professionals.ownerUserId, displayName: professionals.displayName, slug: professionals.slug, isDemo: professionals.isDemo })
    .from(professionals)
    .where(and(eq(professionals.id, professionalId), isPublicListing(), isNull(professionals.deletedAt)))
    .limit(1);
  if (!pro) throw new NotFoundError("Ce professionnel n'est pas disponible.");
  return pro;
}

/** The event's brief, when the actor organises it (null otherwise: the eventId is then ignored). */
async function organiserBrief(tx: DbExecutor, actor: Actor | null, eventId: string | null | undefined): Promise<{ eventId: string; brief: EventBrief } | null> {
  if (!eventId || !actor) return null;
  const access = await getEventAccess(actor, eventId, tx);
  if (!access?.isOrganizer) return null;
  const [e] = await tx.select().from(events).where(and(eq(events.id, eventId), isNull(events.deletedAt))).limit(1);
  if (!e) return null;
  return { eventId, brief: buildBrief(e) };
}

type InquiryDraft = {
  kind: "contact" | "availability" | "quote";
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string | null;
  eventTypeLabel: string | null;
  eventDate: string | null;
  eventCity: string | null;
  guestsCount: number | null;
  childrenCount: number | null;
  message: string;
  eventId: string | null;
  brief: EventBrief | null;
};

async function persistInquiry(tx: DbExecutor, pro: PublicPro, d: InquiryDraft, actor: Actor | null, origin: string): Promise<{ id: string }> {
  const [row] = await tx
    .insert(inquiries)
    .values({
      professionalId: pro.id,
      requesterUserId: actor?.userId ?? null,
      eventId: d.eventId,
      kind: d.kind,
      status: "new",
      requesterName: d.requesterName,
      requesterEmail: d.requesterEmail.toLowerCase(),
      requesterPhone: d.requesterPhone,
      eventTypeLabel: d.eventTypeLabel,
      eventDate: d.eventDate,
      eventCity: d.eventCity,
      guestsCount: d.guestsCount,
      childrenCount: d.childrenCount,
      message: d.message,
      brief: d.brief ?? null,
      isDemo: Boolean(actor?.isDemo) || pro.isDemo,
    })
    .returning({ id: inquiries.id });
  if (!row) throw new Error("insert failed");
  await tx.insert(inquiryEvents).values({ inquiryId: row.id, actorUserId: actor?.userId ?? null, fromStatus: null, toStatus: "new", note: origin });

  const href = `/app/pro/${pro.id}/demandes/${row.id}`;
  await notify(
    {
      userId: pro.ownerUserId,
      type: "inquiry_received",
      title: `Nouvelle demande de ${d.requesterName}`,
      body: d.brief ? briefSummary(d.brief) : d.eventTypeLabel ? `${d.eventTypeLabel}${d.eventDate ? `, ${d.eventDate}` : ""}${d.eventCity ? `, ${d.eventCity}` : ""}` : undefined,
      href,
      dedupeKey: `inquiry:${row.id}`,
    },
    tx,
  );
  // Confirmation to the requester: no third-party data, no message echo beyond what they wrote.
  await enqueueEmail(
    {
      toEmail: d.requesterEmail.toLowerCase(),
      subject: `Votre demande à ${pro.displayName} a bien été transmise`,
      templateKey: "inquiry",
      payload: {
        heading: "Demande transmise",
        intro: `Bonjour ${d.requesterName}, votre demande a été envoyée à ${pro.displayName} via Sous Nos Ailes${d.brief ? ", avec le brief de votre évènement" : ""}. Le professionnel vous répondra directement à cette adresse.`,
        message: d.message ? "Rappel de votre message : " + d.message.slice(0, 500) : "",
        url: new URL(`/pro/${pro.slug}`, env.APP_URL).toString(),
        ctaLabel: "Revoir la fiche du professionnel",
      },
    },
    tx,
  );
  return { id: row.id };
}

/**
 * Creates an inquiry from the public page. The requester may be anonymous.
 * When a signed-in organiser picks one of their events, the event brief replaces the typed
 * event details (one source of truth) and is frozen on the inquiry.
 */
export async function createPublicInquiry(input: PublicInquiryInput, actor: Actor | null): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const pro = await loadPublicPro(tx, input.professionalId);
    const fromEvent = await organiserBrief(tx, actor, input.eventId);
    const b = fromEvent?.brief ?? null;
    if (!b && input.message.trim().length < 10) throw new ValidationError("Décrivez votre besoin en quelques mots (10 caractères minimum).");
    return persistInquiry(
      tx,
      pro,
      {
        kind: input.kind,
        requesterName: input.requesterName,
        requesterEmail: input.requesterEmail,
        requesterPhone: input.requesterPhone || null,
        eventTypeLabel: b ? b.eventTypeLabel : input.eventTypeLabel || null,
        eventDate: b ? b.date : input.eventDate || null,
        eventCity: b ? b.city : input.eventCity || null,
        guestsCount: b ? b.guests : (input.guestsCount ?? null),
        childrenCount: b ? b.children : (input.childrenCount ?? null),
        message: input.message.trim() || (b ? `Demande envoyée avec le brief : ${briefSummary(b)}.` : ""),
        eventId: fromEvent?.eventId ?? null,
        brief: b,
      },
      actor,
      fromEvent ? "Demande reçue depuis la page publique, avec le brief de l'évènement." : "Demande reçue depuis la page publique.",
    );
  });
}

/**
 * Sends the event brief to several professionals at once (one inquiry each). Skips those who
 * already have an open inquiry for this event, and those no longer public.
 */
export async function sendBriefToProfessionals(
  actor: Actor,
  eventId: string,
  input: { professionalIds: string[]; kind: "contact" | "availability" | "quote"; message: string },
): Promise<{ sent: string[]; skipped: { professionalId: string; reason: "already_contacted" | "unavailable" }[] }> {
  return db.transaction(async (tx) => {
    await requireEventPermission(actor, eventId, "event.providers.manage", tx);
    const fromEvent = await organiserBrief(tx, actor, eventId);
    if (!fromEvent) throw new NotFoundError();
    const ids = [...new Set(input.professionalIds)].slice(0, 10);
    const open = await tx
      .select({ professionalId: inquiries.professionalId })
      .from(inquiries)
      .where(and(eq(inquiries.eventId, eventId), inArray(inquiries.professionalId, ids), notInArray(inquiries.status, ["declined", "archived"])));
    const contacted = new Set(open.map((o) => o.professionalId));
    const [me] = await tx.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, actor.userId)).limit(1);
    const sent: string[] = [];
    const skipped: { professionalId: string; reason: "already_contacted" | "unavailable" }[] = [];
    const b = fromEvent.brief;
    for (const professionalId of ids) {
      if (contacted.has(professionalId)) {
        skipped.push({ professionalId, reason: "already_contacted" });
        continue;
      }
      const pro = await loadPublicPro(tx, professionalId).catch(() => null);
      if (!pro) {
        skipped.push({ professionalId, reason: "unavailable" });
        continue;
      }
      const { id } = await persistInquiry(
        tx,
        pro,
        {
          kind: input.kind,
          requesterName: me?.name ?? actor.name,
          requesterEmail: me?.email ?? actor.email,
          requesterPhone: null,
          eventTypeLabel: b.eventTypeLabel,
          eventDate: b.date,
          eventCity: b.city,
          guestsCount: b.guests,
          childrenCount: b.children,
          message: input.message.trim() || `Demande envoyée avec le brief : ${briefSummary(b)}.`,
          eventId,
          brief: b,
        },
        actor,
        "Brief de l'évènement envoyé depuis l'espace organisateur.",
      );
      sent.push(id);
    }
    return { sent, skipped };
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

/**
 * Quote: a new version in the common format (lines, inclusions, deposit, cancellation,
 * validity), status → quoted, e-mail to the requester. A plain amount (older callers) is stored
 * as a version with only a total.
 */
export async function sendQuote(
  actor: Actor,
  professionalId: string,
  inquiryId: string,
  input: { quoteCents: number; quoteNote?: string; quoteFileId?: string | null; message?: string; structured?: StructuredQuote },
): Promise<{ version: number }> {
  return db.transaction(async (tx) => {
    const { inquiry, proName, proSlug } = await loadForManage(actor, professionalId, inquiryId, tx);
    if (inquiry.status !== "quoted" && !canTransitionInquiry(inquiry.status, "quoted")) throw new ConflictError("Impossible d'envoyer un devis à ce stade.");
    const q: StructuredQuote = input.structured ?? { totalCents: input.quoteCents, lineItems: [], inclusions: [], exclusions: [], depositCents: 0, balanceDueDays: null, cancellationPolicy: "moderate", cancellationTerms: null, validUntil: null, note: input.quoteNote || null };
    if (q.totalCents < 0) throw new ValidationError("Montant invalide.");
    const [last] = await tx.select({ v: sql<number>`coalesce(max(${inquiryQuotes.version}), 0)::int` }).from(inquiryQuotes).where(eq(inquiryQuotes.inquiryId, inquiryId));
    const version = (last?.v ?? 0) + 1;
    await tx.insert(inquiryQuotes).values({ inquiryId, version, ...q, quoteFileId: input.quoteFileId ?? null, createdByUserId: actor.userId });
    await tx.update(inquiries).set({ status: "quoted", quoteCents: q.totalCents, quoteNote: q.note, quoteFileId: input.quoteFileId ?? null }).where(eq(inquiries.id, inquiryId));
    await tx.insert(inquiryEvents).values({ inquiryId, actorUserId: actor.userId, fromStatus: inquiry.status === "quoted" ? null : inquiry.status, toStatus: inquiry.status === "quoted" ? null : "quoted", note: `Devis${version > 1 ? ` (version ${version})` : ""} : ${(q.totalCents / 100).toFixed(2)} €${q.note ? ` : ${q.note.slice(0, 500)}` : ""}` });
    const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(q.totalCents / 100);
    const comparePath = inquiry.eventId ? `/app/evenements/${inquiry.eventId}/devis` : null;
    await enqueueEmail(
      {
        toEmail: inquiry.requesterEmail,
        subject: `Devis de ${proName} : ${amount}`,
        templateKey: "inquiry",
        payload: {
          heading: `Devis de ${proName}`,
          intro: `Bonjour ${inquiry.requesterName}, ${proName} vous propose un devis de ${amount}.${q.note ? ` ${q.note}` : ""}`,
          message: input.message ?? "",
          url: inquiry.requesterUserId && comparePath ? new URL(comparePath, env.APP_URL).toString() : new URL(`/pro/${proSlug}`, env.APP_URL).toString(),
          ctaLabel: inquiry.requesterUserId && comparePath ? "Comparer les devis de mon évènement" : "Voir la fiche du professionnel",
        },
      },
      tx,
    );
    if (inquiry.requesterUserId) {
      await notify({ userId: inquiry.requesterUserId, type: "inquiry_updated", title: `Devis reçu de ${proName} : ${amount}`, href: comparePath ?? `/pro/${proSlug}`, eventId: inquiry.eventId ?? undefined }, tx);
    }
    return { version };
  });
}

/** Latest quote version of an inquiry (professional or organiser views). */
export async function latestQuote(inquiryId: string, executor: DbExecutor = db) {
  const [q] = await executor.select().from(inquiryQuotes).where(eq(inquiryQuotes.inquiryId, inquiryId)).orderBy(desc(inquiryQuotes.version)).limit(1);
  return q ?? null;
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

// ── Quote comparison (organiser side) ───────────────────────────────────────
/** Every quote received for the event (latest version each), grouped by trade, compared. */
export async function getEventQuoteComparison(actor: Actor, eventId: string, executor: DbExecutor = db) {
  await requireEventPermission(actor, eventId, "event.inquiries.view", executor);
  const [e] = await executor.select({ expectedGuests: events.expectedGuests }).from(events).where(eq(events.id, eventId)).limit(1);
  const rows = await executor
    .select({ inquiry: inquiries, proName: professionals.displayName, proSlug: professionals.slug, categoryName: professionalCategories.name, categorySlug: professionalCategories.slug })
    .from(inquiries)
    .innerJoin(professionals, eq(professionals.id, inquiries.professionalId))
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(and(eq(inquiries.eventId, eventId), inArray(inquiries.status, ["quoted", "accepted", "confirmed", "declined"])));
  const ids = rows.map((r) => r.inquiry.id);
  const versions = ids.length ? await executor.select().from(inquiryQuotes).where(inArray(inquiryQuotes.inquiryId, ids)).orderBy(desc(inquiryQuotes.version)) : [];
  const latest = new Map<string, (typeof versions)[number]>();
  for (const v of versions) if (!latest.has(v.inquiryId)) latest.set(v.inquiryId, v);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const groups = new Map<string, { categoryName: string; categorySlug: string; quotes: ComparableQuote[]; slugs: Map<string, string> }>();
  for (const r of rows) {
    const v = latest.get(r.inquiry.id);
    const q: ComparableQuote = v
      ? { inquiryId: r.inquiry.id, professionalName: r.proName, categoryName: r.categoryName, status: r.inquiry.status, version: v.version, totalCents: v.totalCents, lineItems: v.lineItems, inclusions: v.inclusions, exclusions: v.exclusions, depositCents: v.depositCents, balanceDueDays: v.balanceDueDays, cancellationPolicy: v.cancellationPolicy as CancellationPolicy, cancellationTerms: v.cancellationTerms, validUntil: v.validUntil, note: v.note }
      : { inquiryId: r.inquiry.id, professionalName: r.proName, categoryName: r.categoryName, status: r.inquiry.status, version: 0, totalCents: r.inquiry.quoteCents ?? 0, lineItems: [], inclusions: [], exclusions: [], depositCents: 0, balanceDueDays: null, cancellationPolicy: "moderate", cancellationTerms: null, validUntil: null, note: r.inquiry.quoteNote };
    const g = groups.get(r.categorySlug) ?? { categoryName: r.categoryName, categorySlug: r.categorySlug, quotes: [] as ComparableQuote[], slugs: new Map<string, string>() };
    g.quotes.push(q);
    g.slugs.set(r.inquiry.id, r.proSlug);
    groups.set(r.categorySlug, g);
  }
  return {
    guests: e?.expectedGuests ?? null,
    groups: [...groups.values()].map((g) => ({ categoryName: g.categoryName, categorySlug: g.categorySlug, proSlugs: Object.fromEntries(g.slugs), comparison: compareQuotes(g.quotes.sort((a, b) => a.totalCents - b.totalCents), e?.expectedGuests ?? null, today) })),
  };
}

/** Organiser's answer to a quote received for their event. */
export async function answerQuote(actor: Actor, eventId: string, inquiryId: string, decision: "accepted" | "declined"): Promise<void> {
  await db.transaction(async (tx) => {
    await requireEventPermission(actor, eventId, "event.providers.manage", tx);
    const [row] = await tx
      .select({ inquiry: inquiries, proName: professionals.displayName, proOwner: professionals.ownerUserId })
      .from(inquiries)
      .innerJoin(professionals, eq(professionals.id, inquiries.professionalId))
      .where(and(eq(inquiries.id, inquiryId), eq(inquiries.eventId, eventId)))
      .limit(1);
    if (!row) throw new NotFoundError();
    if (row.inquiry.status !== "quoted") throw new ConflictError("Ce devis n'attend plus de réponse.");
    const q = await latestQuote(inquiryId, tx);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    if (decision === "accepted" && q?.validUntil && q.validUntil < today) throw new ConflictError("Ce devis a expiré : demandez au professionnel de le mettre à jour.");
    await tx.update(inquiries).set({ status: decision }).where(eq(inquiries.id, inquiryId));
    // The accepted quote feeds the budget and the payment schedule (deposit, balance).
    if (decision === "accepted") await recordAcceptedQuoteInBudget(eventId, inquiryId, tx);
    await tx.insert(inquiryEvents).values({ inquiryId, actorUserId: actor.userId, fromStatus: "quoted", toStatus: decision, note: decision === "accepted" ? `Devis accepté par l'organisateur${q ? ` (version ${q.version})` : ""}.` : "Devis refusé par l'organisateur." });
    await notify(
      {
        userId: row.proOwner,
        type: decision === "accepted" ? "quote_accepted" : "inquiry_updated",
        title: decision === "accepted" ? `Devis accepté pour ${row.inquiry.eventTypeLabel ?? "un évènement"}` : "Devis non retenu",
        body: decision === "accepted" ? "L'organisateur accepte votre devis. Confirmez la réservation pour bloquer la date." : "L'organisateur a choisi une autre proposition.",
        href: `/app/pro/${row.inquiry.professionalId}/demandes/${inquiryId}`,
      },
      tx,
    );
  });
}

