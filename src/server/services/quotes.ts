import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db";
import type { QuoteLineKind, VatMode } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/session";
import { computePricing, totalsFromLines } from "@/domain/pricing";
import { computeNightMinutes } from "@/domain/scheduling";
import { assertTransition } from "@/domain/workflow";
import { durationMinutes, getTimeZoneOffsetMinutes, parseDateOnly } from "@/lib/time";
import { createMagicLink } from "@/lib/auth/magic-link";
import { sendMail } from "@/lib/mail";
import { getEnv } from "@/lib/env";
import { getSettings, listActiveOptions, pricingSettingsFrom } from "@/server/services/settings";
import { recordAudit } from "@/server/services/audit";
import { DomainError, NotFoundError } from "@/server/errors";

export type QuoteLineInput = {
  kind: QuoteLineKind;
  label: string;
  description?: string | null;
  quantityHundredths: number;
  unitPriceCents: number;
};

export type QuoteVersionInput = {
  title: string;
  introText?: string | null;
  validUntil?: string | null;
  vatMode: VatMode;
  vatRateBps: number;
  lines: QuoteLineInput[];
};

function localHour(instant: Date): number {
  return new Date(instant.getTime() + getTimeZoneOffsetMinutes(instant) * 60_000).getUTCHours();
}

/** Builds pricing lines for an event from the configured engine. */
export async function buildSuggestedLines(eventId: string, overrides: { providerCount?: number; travelFeeCents?: number } = {}) {
  const [event, settings, options] = await Promise.all([db.event.findUnique({ where: { id: eventId } }), getSettings(), listActiveOptions()]);
  if (!event) throw new NotFoundError("Événement introuvable.");
  const minutes = event.startsAt && event.endsAt ? durationMinutes(event.startsAt, event.endsAt) : settings.minimumHours * 60;
  const nightMinutes = event.startsAt && event.endsAt ? computeNightMinutes({ startsAt: event.startsAt, endsAt: event.endsAt }, settings.nightSurchargeStartHour, localHour) : 0;
  const isSunday = event.startsAt ? new Date(event.startsAt.getTime() + getTimeZoneOffsetMinutes(event.startsAt) * 60_000).getUTCDay() === 0 : false;
  const result = computePricing({
    durationMinutes: minutes,
    providerCount: overrides.providerCount ?? Math.max(1, event.requiredProviders),
    travelFeeCents: overrides.travelFeeCents ?? settings.defaultTravelFeeCents,
    options: options.filter((o) => event.optionCodes.includes(o.code)).map((o) => ({ code: o.code, label: o.label, priceCents: o.priceCents, pricingUnit: o.pricingUnit })),
    nightMinutes,
    isSunday,
    settings: pricingSettingsFrom(settings),
  });
  return { result, settings, event };
}

/** Returns the open draft or creates one (from the current version or the engine). */
export async function getOrCreateDraft(eventId: string, actor: SessionUser) {
  const quote = await db.quote.upsert({ where: { eventId }, create: { eventId }, update: {}, include: { versions: { include: { lines: { orderBy: { sortOrder: "asc" } } }, orderBy: { number: "desc" } } } });
  const draft = quote.versions.find((v) => v.status === "DRAFT");
  if (draft) return draft;
  const current = quote.versions.find((v) => v.status === "ACCEPTED" || v.status === "SENT") ?? quote.versions[0] ?? null;
  const number = (quote.versions[0]?.number ?? 0) + 1;
  const { result, settings, event } = await buildSuggestedLines(eventId);
  const lines = current
    ? current.lines.map((l, index) => ({ kind: l.kind, label: l.label, description: l.description, quantityHundredths: l.quantityHundredths, unitPriceCents: l.unitPriceCents, totalCents: l.totalCents, sortOrder: index }))
    : result.lines.map((l, index) => ({ kind: l.kind, label: l.label, description: l.description ?? null, quantityHundredths: l.quantityHundredths, unitPriceCents: l.unitPriceCents, totalCents: l.totalCents, sortOrder: index }));
  const vatMode = current?.vatMode ?? settings.vatMode;
  const vatRateBps = current?.vatRateBps ?? (settings.vatMode === "STANDARD" ? settings.vatRateBps : 0);
  const totals = totalsFromLines(lines, vatMode, vatRateBps);
  const created = await db.$transaction(async (tx) => {
    const version = await tx.quoteVersion.create({
      data: {
        quoteId: quote.id,
        number,
        status: "DRAFT",
        title: current?.title ?? `Proposition — ${event.title}`,
        introText: current?.introText ?? `Proposition établie pour ${event.title}. Les montants ci-dessous correspondent aux éléments connus à ce jour et pourront être ajustés après échange.`,
        validUntil: current?.validUntil ?? null,
        vatMode,
        vatRateBps,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        totalExclVatCents: totals.totalExclVatCents,
        vatCents: totals.vatCents,
        totalInclVatCents: totals.totalInclVatCents,
        lines: { create: lines },
      },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "quote.draft.created", entityType: "Event", entityId: eventId, summary: `Version ${number} créée (brouillon)` }, tx);
    return version;
  });
  return created;
}

export async function updateDraft(versionId: string, input: QuoteVersionInput, actor: SessionUser): Promise<void> {
  const version = await db.quoteVersion.findUnique({ where: { id: versionId }, include: { quote: true } });
  if (!version) throw new NotFoundError("Version introuvable.");
  if (version.status !== "DRAFT") throw new DomainError("Une version transmise est immuable : créez une nouvelle version.");
  if (!input.lines.length) throw new DomainError("Ajoutez au moins une ligne.");
  const totals = totalsFromLines(input.lines, input.vatMode, input.vatRateBps);
  await db.$transaction(async (tx) => {
    await tx.quoteLine.deleteMany({ where: { versionId } });
    await tx.quoteVersion.update({
      where: { id: versionId },
      data: {
        title: input.title,
        introText: input.introText ?? null,
        validUntil: input.validUntil ? parseDateOnly(input.validUntil) : null,
        vatMode: input.vatMode,
        vatRateBps: input.vatRateBps,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        totalExclVatCents: totals.totalExclVatCents,
        vatCents: totals.vatCents,
        totalInclVatCents: totals.totalInclVatCents,
        lines: {
          create: input.lines.map((line, index) => ({
            sortOrder: index,
            kind: line.kind,
            label: line.label,
            description: line.description ?? null,
            quantityHundredths: line.quantityHundredths,
            unitPriceCents: line.unitPriceCents,
            totalCents: totals.lineTotals[index],
          })),
        },
      },
    });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "quote.draft.updated", entityType: "Event", entityId: version.quote.eventId, summary: `Version ${version.number} modifiée` }, tx);
  });
}

/** Freezes the draft as SENT, supersedes the previous current version, moves the event to PROPOSAL_SENT and emails the client. */
export async function sendVersion(versionId: string, actor: SessionUser): Promise<void> {
  const version = await db.quoteVersion.findUnique({ where: { id: versionId }, include: { quote: { include: { event: { include: { client: true } }, versions: true } } } });
  if (!version) throw new NotFoundError("Version introuvable.");
  if (version.status !== "DRAFT") throw new DomainError("Seule une version brouillon peut être transmise.");
  const event = version.quote.event;
  const from = event.status;
  const to = "PROPOSAL_SENT" as const;
  const needsTransition = from !== "PROPOSAL_SENT";
  if (needsTransition) {
    // NEW requests are implicitly qualified by sending a proposal.
    assertTransition(from === "NEW" ? "QUALIFYING" : from, to);
  }
  await db.$transaction(async (tx) => {
    await tx.quoteVersion.updateMany({ where: { quoteId: version.quoteId, status: { in: ["SENT", "ACCEPTED"] } }, data: { status: "SUPERSEDED", supersededAt: new Date() } });
    await tx.quoteVersion.update({ where: { id: versionId }, data: { status: "SENT", sentAt: new Date() } });
    if (needsTransition) await tx.event.update({ where: { id: event.id }, data: { status: to } });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "quote.sent", entityType: "Event", entityId: event.id, summary: `Version ${version.number} transmise au client` }, tx);
  });
  const settings = await getSettings();
  const { url } = await createMagicLink(event.clientId);
  await sendMail(
    {
      to: event.client.email,
      subject: `Votre proposition pour ${event.title} (${event.reference})`,
      template: "quote-sent",
      heading: "Votre proposition est disponible",
      paragraphs: [
        `Bonjour ${event.client.name},`,
        `${settings.ownerFirstName} a préparé une proposition (version ${version.number}) pour ${event.title}. Vous pouvez la consulter dans votre espace et indiquer si elle vous convient.`,
        "Cet accord de principe permet de lancer la constitution de l’équipe ; la prestation sera confirmée une fois l’équipe au complet et les points pratiques validés.",
      ],
      cta: { label: "Consulter la proposition", url },
      entityType: "Event",
      entityId: event.id,
    },
    settings.brandName,
  );
}

/** Client agreement in principle on the current SENT version. Not a certified e-signature. */
export async function acceptVersion(versionId: string, client: SessionUser): Promise<void> {
  const version = await db.quoteVersion.findUnique({ where: { id: versionId }, include: { quote: { include: { event: true } } } });
  if (!version || version.quote.event.clientId !== client.id) throw new NotFoundError("Proposition introuvable.");
  if (version.status !== "SENT") throw new DomainError("Cette version n’est plus la proposition courante.");
  const event = version.quote.event;
  assertTransition(event.status, "AGREED");
  await db.$transaction(async (tx) => {
    await tx.quoteVersion.update({ where: { id: versionId }, data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedByUserId: client.id } });
    await tx.event.update({ where: { id: event.id }, data: { status: "AGREED" } });
    await recordAudit({ actorId: client.id, actorRole: "CLIENT", action: "quote.accepted", entityType: "Event", entityId: event.id, summary: `Accord de principe du client sur la version ${version.number}` }, tx);
  });
  const settings = await getSettings();
  const env = getEnv();
  await sendMail(
    {
      to: settings.contactEmail,
      subject: `Accord de principe — ${event.reference}`,
      template: "quote-accepted",
      heading: "Le client a donné son accord de principe",
      paragraphs: [`La version ${version.number} de la proposition pour ${event.title} vient d’être acceptée. L’équipe peut maintenant être constituée.`],
      cta: { label: "Ouvrir l’événement", url: `${env.APP_URL}/admin/evenements/${event.id}` },
      entityType: "Event",
      entityId: event.id,
    },
    settings.brandName,
  );
}

export async function withdrawVersion(versionId: string, actor: SessionUser): Promise<void> {
  const version = await db.quoteVersion.findUnique({ where: { id: versionId }, include: { quote: true } });
  if (!version) throw new NotFoundError("Version introuvable.");
  if (version.status !== "DRAFT") throw new DomainError("Seul un brouillon peut être supprimé ; une version transmise reste dans l’historique.");
  await db.$transaction(async (tx) => {
    await tx.quoteVersion.delete({ where: { id: versionId } });
    await recordAudit({ actorId: actor.id, actorRole: actor.role, action: "quote.draft.deleted", entityType: "Event", entityId: version.quote.eventId, summary: `Brouillon ${version.number} supprimé` }, tx);
  });
}

export type QuoteVersionWithLines = Prisma.QuoteVersionGetPayload<{ include: { lines: true } }>;

export async function getVersionForClient(versionId: string, clientUserId: string) {
  const version = await db.quoteVersion.findFirst({
    where: { id: versionId, status: { in: ["SENT", "ACCEPTED", "SUPERSEDED"] }, quote: { event: { clientId: clientUserId } } },
    include: { lines: { orderBy: { sortOrder: "asc" } }, quote: { include: { event: { include: { client: { select: { name: true, email: true } }, venue: { select: { name: true } } } } } } },
  });
  return version;
}

export async function getVersionForAdmin(versionId: string) {
  return db.quoteVersion.findUnique({
    where: { id: versionId },
    include: { lines: { orderBy: { sortOrder: "asc" } }, quote: { include: { event: { include: { client: { select: { name: true, email: true } }, venue: { select: { name: true } } } } } }, acceptedBy: { select: { name: true } } },
  });
}
