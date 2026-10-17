import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db";
import type { ReferralSourceKind, RequestSource } from "@/generated/prisma/enums";
import { computeEventInstants, formatDateOnlyShort, parseDateOnly } from "@/lib/time";
import { createMagicLink } from "@/lib/auth/magic-link";
import { sendMail } from "@/lib/mail";
import { getEnv } from "@/lib/env";
import { EVENT_TYPE_LABELS } from "@/domain/labels";
import { suggestProviderCount } from "@/domain/staffing";
import type { EventRequestInput } from "@/validation/event-request";
import { getSettings, listActiveOptions, staffingRatiosFrom } from "@/server/services/settings";
import { allocateReference } from "@/server/services/references";
import { findOrCreateClientUser } from "@/server/services/users";
import { recordAudit } from "@/server/services/audit";
import { syncChecklistForEvent } from "@/server/services/checklist";
import { DomainError } from "@/server/errors";

export type SubmitEventRequestResult = {
  reference: string;
  eventId: string;
  clientUserId: string;
  alreadyExisted: boolean;
};

export type SubmitContext = {
  referralCode?: string | null;
  referralSourceKind?: ReferralSourceKind;
};

function buildTitle(eventType: EventRequestInput["eventType"], city: string, date: Date | null): string {
  const base = `${EVENT_TYPE_LABELS[eventType]} — ${city}`;
  return date ? `${base} — ${formatDateOnlyShort(date)}` : base;
}

/**
 * Persists a public request as an immutable EventRequest plus a working Event,
 * attaches the partner attribution when valid, and sends the acknowledgement.
 * Idempotent on submissionKey (double submissions return the first result).
 */
export async function submitEventRequest(input: EventRequestInput, context: SubmitContext = {}): Promise<SubmitEventRequestResult> {
  const existing = await db.eventRequest.findUnique({ where: { submissionKey: input.submissionKey }, include: { event: true } });
  if (existing?.event) {
    return { reference: existing.event.reference, eventId: existing.event.id, clientUserId: existing.event.clientId, alreadyExisted: true };
  }

  const [settings, activeOptions] = await Promise.all([getSettings(), listActiveOptions()]);
  const knownCodes = new Set(activeOptions.map((o) => o.code));
  const optionCodes = input.optionCodes.filter((code) => knownCodes.has(code));

  const partnerVenue =
    input.venueMode === "PARTNER" && input.venueId
      ? await db.partnerVenue.findFirst({ where: { id: input.venueId, editorialStatus: "PUBLISHED" } })
      : null;
  if (input.venueMode === "PARTNER" && !partnerVenue) {
    throw new DomainError("Le lieu partenaire sélectionné n’est pas disponible. Choisissez un lieu libre.");
  }

  // Partner attribution: the code is a non-sensitive identifier validated here, server-side.
  const referralVenue = context.referralCode
    ? await db.partnerVenue.findFirst({ where: { referralCode: context.referralCode, partnershipStatus: { not: "ENDED" } } })
    : null;
  let source: RequestSource = "DIRECT";
  let referral: { venueId: string; sourceKind: ReferralSourceKind } | null = null;
  if (referralVenue) {
    source = "PARTNER_LINK";
    referral = { venueId: referralVenue.id, sourceKind: context.referralSourceKind ?? "LINK" };
  } else if (partnerVenue) {
    source = "VENUE_PAGE";
    referral = { venueId: partnerVenue.id, sourceKind: "VENUE_PAGE" };
  }

  const fixed = input.dateMode === "FIXED";
  const eventDate = input.eventDate ? parseDateOnly(input.eventDate) : null;
  const eventEndDate = input.eventEndDate ? parseDateOnly(input.eventEndDate) : null;
  const startTime = input.startTime || null;
  const endTime = input.endTime || null;
  const instants =
    input.eventDate && startTime && endTime
      ? computeEventInstants({ date: input.eventDate, endDate: input.eventEndDate || null, startTime, endTime })
      : null;

  const headcount = {
    childrenUnder3: input.childrenUnder3,
    children3to5: input.children3to5,
    children6to10: input.children6to10,
    children11plus: input.children11plus,
  };
  const staffing = suggestProviderCount(headcount, staffingRatiosFrom(settings));
  const venueName = partnerVenue ? partnerVenue.name : input.venueName ?? null;

  const result = await db.$transaction(async (tx) => {
    const { userId, created } = await findOrCreateClientUser(tx, {
      email: input.organizerEmail,
      name: input.organizerName,
      phone: input.organizerPhone ?? null,
    });
    const reference = await allocateReference(tx);
    const request = await tx.eventRequest.create({
      data: {
        eventType: input.eventType,
        eventDate,
        eventEndDate,
        dateIsFlexible: !fixed,
        dateNote: input.dateNote ?? null,
        startTime,
        endTime,
        venueId: partnerVenue?.id ?? null,
        venueName,
        city: input.city,
        postalCode: input.postalCode,
        ...headcount,
        parentsOnSite: input.parentsOnSite,
        dedicatedSpace: input.dedicatedSpace,
        optionCodes,
        organizerName: input.organizerName,
        organizerEmail: input.organizerEmail,
        organizerPhone: input.organizerPhone ?? null,
        organizerRole: input.organizerRole ?? null,
        message: input.message ?? null,
        privacyAcceptedAt: new Date(),
        marketingOptIn: input.marketingOptIn === "on",
        source,
        submissionKey: input.submissionKey,
      },
    });
    const event = await tx.event.create({
      data: {
        reference,
        requestId: request.id,
        clientId: userId,
        status: "NEW",
        title: buildTitle(input.eventType, input.city, eventDate),
        eventType: input.eventType,
        date: eventDate,
        endDate: instants ? parseDateOnly(instants.endDateOnly) : eventEndDate,
        dateIsFlexible: !fixed,
        dateNote: input.dateNote ?? null,
        startTime,
        endTime,
        startsAt: instants?.startsAt ?? null,
        endsAt: instants?.endsAt ?? null,
        venueId: partnerVenue?.id ?? null,
        venueName,
        city: input.city,
        postalCode: input.postalCode,
        ...headcount,
        parentsOnSite: input.parentsOnSite,
        dedicatedSpace: input.dedicatedSpace,
        optionCodes,
        requiredProviders: staffing.suggested,
      },
    });
    if (referral) {
      await tx.referral.create({ data: { venueId: referral.venueId, requestId: request.id, sourceKind: referral.sourceKind } });
    }
    await syncChecklistForEvent(tx, event.id);
    await recordAudit(
      {
        actorId: null,
        actorRole: "CLIENT",
        action: "request.submitted",
        entityType: "Event",
        entityId: event.id,
        summary: `Demande ${reference} reçue (${source === "DIRECT" ? "site" : "apport partenaire"})`,
      },
      tx,
    );
    return { reference, eventId: event.id, clientUserId: userId, clientCreated: created };
  });

  await sendAcknowledgement({ ...result, organizerEmail: input.organizerEmail, organizerName: input.organizerName, eventTitle: buildTitle(input.eventType, input.city, eventDate) });
  await notifyAdminOfNewRequest({ reference: result.reference, eventId: result.eventId, title: buildTitle(input.eventType, input.city, eventDate), city: input.city, source });

  return { reference: result.reference, eventId: result.eventId, clientUserId: result.clientUserId, alreadyExisted: false };
}

async function sendAcknowledgement(input: { reference: string; eventId: string; clientUserId: string; organizerEmail: string; organizerName: string; eventTitle: string }) {
  const settings = await getSettings();
  const { url } = await createMagicLink(input.clientUserId);
  await sendMail(
    {
      to: input.organizerEmail,
      subject: `Votre demande ${input.reference} est bien reçue`,
      template: "request-acknowledgement",
      heading: "Nous avons bien reçu votre demande",
      paragraphs: [
        `Bonjour ${input.organizerName},`,
        `Merci pour votre demande concernant « ${input.eventTitle} ». Sa référence est ${input.reference}.`,
        `${settings.ownerFirstName} l’étudie personnellement et revient vers vous rapidement pour préciser les détails et vous transmettre une proposition. Ce message est un accusé de réception : il ne constitue pas une réservation confirmée.`,
        "Vous pouvez suivre l’avancement de votre dossier dans votre espace client, accessible grâce au lien ci-dessous (valable 20 minutes, un nouveau lien peut être demandé à tout moment depuis la page de connexion).",
      ],
      cta: { label: "Suivre mon événement", url },
      footerNote: "Merci de ne transmettre aucune information médicale ou sensible concernant les enfants par email.",
      entityType: "Event",
      entityId: input.eventId,
    },
    settings.brandName,
  );
}

async function notifyAdminOfNewRequest(input: { reference: string; eventId: string; title: string; city: string; source: RequestSource }) {
  const settings = await getSettings();
  const env = getEnv();
  await sendMail(
    {
      to: settings.contactEmail,
      subject: `Nouvelle demande ${input.reference} — ${input.title}`,
      template: "request-admin-notification",
      heading: "Nouvelle demande reçue",
      paragraphs: [
        `Une nouvelle demande vient d’arriver : ${input.title} (${input.city}).`,
        `Origine : ${input.source === "DIRECT" ? "site public" : input.source === "PARTNER_LINK" ? "lien partenaire" : "page d’un lieu partenaire"}.`,
      ],
      cta: { label: "Ouvrir la demande", url: `${env.APP_URL}/admin/evenements/${input.eventId}` },
      entityType: "Event",
      entityId: input.eventId,
    },
    settings.brandName,
  );
}

export type SubmitTx = Prisma.TransactionClient;
