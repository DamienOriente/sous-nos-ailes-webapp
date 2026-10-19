import { and, asc, count, desc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { events, professionalHolds, professionals, users } from "@/db/schema";
import { env } from "@/lib/env";
import { ConflictError, NotFoundError, RateLimitedError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { getEventAccess, requireProfessionalManage } from "@/modules/authorization";
import { activeHoldCondition, availabilityOn } from "@/modules/directory/application/availability";
import { isPublicListing } from "@/modules/directory/application/public-listing";
import { BUSY_REASON_LABELS, HOLD_HOURS, isFutureOrToday, isIsoDate, MAX_ACTIVE_HOLDS_PER_USER } from "@/modules/directory/domain/availability";
import { enqueueEmail } from "@/modules/notifications/application/email-outbox";
import { notify } from "@/modules/notifications/application/notification-service";
import { recordAudit } from "@/modules/admin/application/audit";

export type HoldRow = typeof professionalHolds.$inferSelect;

function frDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)));
}

function frDateTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(d);
}

/** Marks lapsed options as expired (also run hourly by the worker; reads never rely on it). */
export async function expireHolds(executor: DbExecutor = db): Promise<number> {
  const rows = await executor
    .update(professionalHolds)
    .set({ status: "expired", resolvedAt: sql`now()` })
    .where(and(eq(professionalHolds.status, "active"), lte(professionalHolds.expiresAt, sql`now()`)))
    .returning({ id: professionalHolds.id });
  return rows.length;
}

/**
 * Places a 48-hour option on a professional's day. Race-free per (professional, day): two
 * organisers clicking at once get one option and one "already held" answer.
 */
export async function placeHold(actor: Actor, input: { professionalId: string; date: string; eventId?: string | null }): Promise<HoldRow> {
  if (!isIsoDate(input.date)) throw new ValidationError("Date invalide.");
  if (!isFutureOrToday(input.date)) throw new ValidationError("Cette date est passée.");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`hold:${input.professionalId}:${input.date}`}))`);
    const [pro] = await tx
      .select({ id: professionals.id, ownerUserId: professionals.ownerUserId, displayName: professionals.displayName, isDemo: professionals.isDemo })
      .from(professionals)
      .where(and(eq(professionals.id, input.professionalId), isPublicListing()))
      .limit(1);
    if (!pro) throw new NotFoundError("Ce professionnel n'est pas disponible.");
    if (pro.ownerUserId === actor.userId) throw new ConflictError("Vous ne pouvez pas poser une option sur votre propre fiche.");
    let eventId: string | null = null;
    if (input.eventId) {
      const access = await getEventAccess(actor, input.eventId, tx);
      if (!access?.isOrganizer) throw new NotFoundError();
      eventId = input.eventId;
    }
    const [mine] = await tx
      .select()
      .from(professionalHolds)
      .where(and(eq(professionalHolds.professionalId, pro.id), eq(professionalHolds.holdDate, input.date), eq(professionalHolds.requesterUserId, actor.userId), activeHoldCondition()))
      .limit(1);
    if (mine) return mine;
    const availability = (await availabilityOn([pro.id], input.date, actor.userId, tx)).get(pro.id);
    if (availability && !availability.available && availability.reason) throw new ConflictError(`Option impossible : ${BUSY_REASON_LABELS[availability.reason].toLowerCase()}.`);
    const [active] = await tx
      .select({ n: count() })
      .from(professionalHolds)
      .where(and(eq(professionalHolds.requesterUserId, actor.userId), eq(professionalHolds.status, "active"), gt(professionalHolds.expiresAt, sql`now()`)));
    if ((active?.n ?? 0) >= MAX_ACTIVE_HOLDS_PER_USER) throw new RateLimitedError(`Vous avez déjà ${MAX_ACTIVE_HOLDS_PER_USER} options en cours. Libérez-en une avant d'en poser une autre.`);

    const expiresAt = new Date(Date.now() + HOLD_HOURS * 3600 * 1000);
    const [row] = await tx
      .insert(professionalHolds)
      .values({ professionalId: pro.id, requesterUserId: actor.userId, eventId, holdDate: input.date, status: "active", expiresAt, isDemo: actor.isDemo || pro.isDemo })
      .returning();
    if (!row) throw new Error("hold insert failed");
    const href = `/app/pro/${pro.id}/demandes#options`;
    await notify({ userId: pro.ownerUserId, type: "inquiry_received", title: `Option posée sur le ${frDate(input.date)}`, body: `${actor.name} réserve votre date jusqu'au ${frDateTime(expiresAt)}. Confirmez ou libérez-la.`, href, dedupeKey: `hold:${row.id}` }, tx);
    const [owner] = await tx.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, pro.ownerUserId)).limit(1);
    if (owner) {
      await enqueueEmail(
        {
          toEmail: owner.email,
          subject: `Option posée sur votre date du ${frDate(input.date)}`,
          templateKey: "inquiry",
          payload: {
            heading: "Une date vous est réservée",
            intro: `Bonjour ${owner.name}, ${actor.name} a posé une option de ${HOLD_HOURS} heures sur « ${pro.displayName} » pour le ${frDate(input.date)}.`,
            message: `Sans réponse de votre part, l'option tombe le ${frDateTime(expiresAt)}. Pendant ce temps, la date n'est plus proposée aux autres organisateurs.`,
            url: new URL(href, env.APP_URL).toString(),
            ctaLabel: "Confirmer ou libérer la date",
          },
        },
        tx,
      );
    }
    await recordAudit(tx, { actorUserId: actor.userId, action: "hold.placed", resourceType: "professional", resourceId: pro.id, metadata: { holdId: row.id, date: input.date, eventId } });
    return row;
  });
}

async function loadHold(tx: DbExecutor, holdId: string) {
  const [row] = await tx
    .select({ hold: professionalHolds, proName: professionals.displayName, proOwner: professionals.ownerUserId, proSlug: professionals.slug })
    .from(professionalHolds)
    .innerJoin(professionals, eq(professionals.id, professionalHolds.professionalId))
    .where(eq(professionalHolds.id, holdId))
    .limit(1);
  if (!row) throw new NotFoundError();
  return row;
}

const isLive = (h: HoldRow) => h.status === "active" && h.expiresAt.getTime() > Date.now();

/** The organiser who placed it, or the professional, releases the option. */
export async function releaseHold(actor: Actor, holdId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const { hold, proName, proOwner } = await loadHold(tx, holdId);
    const byRequester = hold.requesterUserId === actor.userId;
    if (!byRequester) await requireProfessionalManage(actor, hold.professionalId, tx);
    if (!isLive(hold) && hold.status !== "confirmed") throw new ConflictError("Cette option n'est plus active.");
    await tx.update(professionalHolds).set({ status: "released", resolvedAt: new Date(), resolvedByUserId: actor.userId }).where(eq(professionalHolds.id, holdId));
    const notifyUser = byRequester ? proOwner : hold.requesterUserId;
    await notify({ userId: notifyUser, type: "inquiry_updated", title: `Option libérée : ${proName}, ${frDate(hold.holdDate)}`, body: byRequester ? "L'organisateur a libéré la date." : "Le professionnel a libéré la date.", href: byRequester ? `/app/pro/${hold.professionalId}/demandes#options` : hold.eventId ? `/app/evenements/${hold.eventId}/demandes` : "/app" }, tx);
    await recordAudit(tx, { actorUserId: actor.userId, action: "hold.released", resourceType: "professional", resourceId: hold.professionalId, metadata: { holdId } });
  });
}

/** The professional confirms the date: it stays blocked for everyone else. */
export async function confirmHold(actor: Actor, holdId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const { hold, proName } = await loadHold(tx, holdId);
    await requireProfessionalManage(actor, hold.professionalId, tx);
    if (!isLive(hold)) throw new ConflictError("Cette option a expiré ou a déjà été traitée.");
    await tx.update(professionalHolds).set({ status: "confirmed", resolvedAt: new Date(), resolvedByUserId: actor.userId }).where(eq(professionalHolds.id, holdId));
    await notify({ userId: hold.requesterUserId, type: "quote_accepted", title: `${proName} confirme le ${frDate(hold.holdDate)}`, body: "La date vous est réservée. Finalisez avec le devis et le contrat.", href: hold.eventId ? `/app/evenements/${hold.eventId}/devis` : "/app", eventId: hold.eventId ?? undefined }, tx);
    await recordAudit(tx, { actorUserId: actor.userId, action: "hold.confirmed", resourceType: "professional", resourceId: hold.professionalId, metadata: { holdId } });
  });
}

/** Options on a listing, upcoming days first (professional side). */
export async function listHoldsForProfessional(actor: Actor, professionalId: string, executor: DbExecutor = db) {
  await requireProfessionalManage(actor, professionalId, executor);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  return executor
    .select({ hold: professionalHolds, requesterName: users.name, eventName: events.name })
    .from(professionalHolds)
    .innerJoin(users, eq(users.id, professionalHolds.requesterUserId))
    .leftJoin(events, eq(events.id, professionalHolds.eventId))
    .where(and(eq(professionalHolds.professionalId, professionalId), gte(professionalHolds.holdDate, today), inArray(professionalHolds.status, ["active", "confirmed"])))
    .orderBy(asc(professionalHolds.holdDate));
}

/** Options placed by the organiser (optionally for one event). */
export async function listMyHolds(actor: Actor, eventId?: string, executor: DbExecutor = db) {
  return executor
    .select({ hold: professionalHolds, proName: professionals.displayName, proSlug: professionals.slug })
    .from(professionalHolds)
    .innerJoin(professionals, eq(professionals.id, professionalHolds.professionalId))
    .where(and(eq(professionalHolds.requesterUserId, actor.userId), eventId ? eq(professionalHolds.eventId, eventId) : undefined))
    .orderBy(desc(professionalHolds.createdAt))
    .limit(50);
}

export { isLive as isHoldLive };

/** Options placed for an event, by any of its organisers (event page). */
export async function listEventHolds(actor: Actor, eventId: string, executor: DbExecutor = db) {
  const access = await getEventAccess(actor, eventId, executor);
  if (!access?.isOrganizer) throw new NotFoundError();
  return executor
    .select({ hold: professionalHolds, proName: professionals.displayName, proSlug: professionals.slug, requesterName: users.name })
    .from(professionalHolds)
    .innerJoin(professionals, eq(professionals.id, professionalHolds.professionalId))
    .innerJoin(users, eq(users.id, professionalHolds.requesterUserId))
    .where(and(eq(professionalHolds.eventId, eventId), inArray(professionalHolds.status, ["active", "confirmed"])))
    .orderBy(desc(professionalHolds.createdAt));
}
