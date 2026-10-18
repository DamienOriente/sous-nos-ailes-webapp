import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { reports } from "@/db/schema";
import { RateLimitedError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getContactEmail } from "@/modules/legal/application/legal-pages";
import { consumeRateLimit } from "@/modules/legal/infrastructure/rate-limit";
import { openModerationCase } from "@/modules/moderation/application/moderation-service";
import { enqueueEmail } from "@/modules/notifications/application/email-outbox";
import { REPORT_REASON_LABELS, REPORT_REASONS, REPORT_RESOURCE_LABELS, REPORT_RESOURCE_TYPES } from "@/modules/legal/domain/reports";

/**
 * Public, unauthenticated forms (contact, content report). Both share the same
 * defences: Zod validation, honeypot field, Redis rate limit per client.
 */
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email: z.email("Adresse e-mail invalide.").max(254),
  subject: z.string().trim().min(3, "Indiquez un sujet.").max(150),
  message: z.string().trim().min(20, "Décrivez votre demande en quelques phrases (20 caractères minimum).").max(4000),
  /** Honeypot: must stay empty. Bots fill every field. */
  website: z.string().max(0).optional().or(z.literal("")),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const reportSchema = z.object({
  resourceType: z.enum(REPORT_RESOURCE_TYPES),
  resourceRef: z.string().trim().min(2, "Indiquez le lien ou le nom du contenu.").max(500),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().min(10, "Expliquez le problème en quelques mots (10 caractères minimum).").max(4000),
  reporterEmail: z.email("Adresse e-mail invalide.").max(254).optional().or(z.literal("")),
  website: z.string().max(0).optional().or(z.literal("")),
});
export type ReportInput = z.infer<typeof reportSchema>;

export type PublicFormContext = { clientKey: string; userId?: string | null };

const CONTACT_LIMIT = { max: 5, windowSeconds: 3600 };
const REPORT_LIMIT = { max: 10, windowSeconds: 3600 };

export async function submitContactMessage(input: ContactInput, ctx: PublicFormContext, executor: DbExecutor = db): Promise<{ delivered: boolean }> {
  if (input.website) {
    // Honeypot hit: pretend success so the bot learns nothing, log for security review.
    logger.info({ form: "contact" }, "honeypot triggered");
    return { delivered: true };
  }
  const limit = await consumeRateLimit("contact", ctx.clientKey, CONTACT_LIMIT.max, CONTACT_LIMIT.windowSeconds);
  if (!limit.allowed) throw new RateLimitedError("Trop de messages envoyés. Réessayez dans une heure.");
  const to = await getContactEmail(executor);
  if (!to) throw new ValidationError("Le formulaire de contact n'est pas encore activé. Réessayez plus tard.");
  await enqueueEmail(
    {
      toEmail: to,
      subject: `[Contact] ${input.subject}`,
      templateKey: "generic",
      payload: { body: `De : ${input.name} <${input.email}>\n\n${input.message}` },
    },
    executor,
  );
  return { delivered: true };
}

export async function submitReport(input: ReportInput, ctx: PublicFormContext, executor: DbExecutor = db): Promise<{ reportId: string | null }> {
  if (input.website) {
    logger.info({ form: "report" }, "honeypot triggered");
    return { reportId: null };
  }
  const limit = await consumeRateLimit("report", ctx.clientKey, REPORT_LIMIT.max, REPORT_LIMIT.windowSeconds);
  if (!limit.allowed) throw new RateLimitedError("Trop de signalements envoyés. Réessayez dans une heure.");

  const reporterEmail = input.reporterEmail ? input.reporterEmail : null;
  const summary = `${REPORT_RESOURCE_LABELS[input.resourceType]} : ${REPORT_REASON_LABELS[input.reason]}`;
  const { caseId } = await openModerationCase(
    { kind: "report", resourceType: input.resourceType, resourceId: input.resourceRef.slice(0, 200), openedByUserId: ctx.userId ?? null, summary },
    executor,
  );
  const [row] = await executor
    .insert(reports)
    .values({
      reporterUserId: ctx.userId ?? null,
      reporterEmail,
      resourceType: input.resourceType,
      resourceId: input.resourceRef.slice(0, 500),
      reason: input.reason,
      details: input.details,
      caseId,
    })
    .returning({ id: reports.id });
  if (reporterEmail) {
    await enqueueEmail(
      {
        toEmail: reporterEmail,
        subject: "Nous avons bien reçu votre signalement",
        templateKey: "generic",
        payload: { body: "Merci. Votre signalement a été enregistré et sera examiné par notre équipe de modération. Vous serez informé de la suite donnée si une adresse e-mail a été fournie." },
      },
      executor,
    );
  }
  return { reportId: row?.id ?? null };
}
