import { and, eq, lt, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { emailOutbox } from "@/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { buildMarketingUnsubscribeUrl } from "@/modules/notifications/application/unsubscribe";
import { renderEmail } from "@/modules/notifications/infrastructure/email-templates";
import { sendMail } from "@/modules/notifications/infrastructure/mailer";

/**
 * Template keys. Everything but `marketing` is transactional: no unsubscribe
 * link, sent regardless of marketing consent. `marketing` requires
 * `payload.userId` and carries the one-click opt-out (List-Unsubscribe).
 */
export const EMAIL_TEMPLATE_KEYS = ["notification", "invitation", "inquiry", "generic", "marketing"] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export type OutboxInput = { toEmail: string; subject: string; templateKey: EmailTemplateKey | (string & {}); payload: Record<string, unknown> };

/**
 * Transactional e-mails go through a DB outbox: the worker drains it with
 * retries + exponential backoff, failures are kept for inspection. In the
 * request path we only insert a row (fast, transactional with the business write).
 */
export async function enqueueEmail(input: OutboxInput, executor: DbExecutor = db): Promise<void> {
  await executor.insert(emailOutbox).values({ toEmail: input.toEmail, subject: input.subject, templateKey: input.templateKey, payload: input.payload });
}

const MAX_ATTEMPTS = 5;

function render(templateKey: string, subject: string, payload: Record<string, unknown>) {
  const str = (k: string) => (typeof payload[k] === "string" ? (payload[k] as string) : "");
  switch (templateKey) {
    case "notification":
      return renderEmail({
        subject,
        heading: str("title") || subject,
        paragraphs: [str("name") ? `Bonjour ${str("name")},` : "Bonjour,", str("body") || "Vous avez une nouvelle notification sur Sous Nos Ailes."].filter(Boolean),
        cta: { label: "Ouvrir", url: new URL(str("href") || "/app/notifications", env.APP_URL).toString() },
        footer: "Vous pouvez ajuster vos préférences de notification depuis votre compte.",
      });
    case "invitation":
      return renderEmail({
        subject,
        heading: str("heading") || subject,
        paragraphs: [str("intro"), str("message")].filter(Boolean),
        cta: { label: str("ctaLabel") || "Répondre à l'invitation", url: str("url") },
        footer: "Cette invitation vous a été envoyée par l'organisateur de l'évènement via Sous Nos Ailes.",
      });
    case "inquiry":
      return renderEmail({
        subject,
        heading: str("heading") || subject,
        paragraphs: [str("intro"), str("message")].filter(Boolean),
        cta: str("url") ? { label: str("ctaLabel") || "Voir la demande", url: str("url") } : undefined,
      });
    case "marketing": {
      const unsubscribeUrl = str("userId") ? buildMarketingUnsubscribeUrl(str("userId")) : undefined;
      return {
        ...renderEmail({
          subject,
          heading: str("heading") || subject,
          paragraphs: [str("intro"), str("body")].filter(Boolean),
          cta: str("url") ? { label: str("ctaLabel") || "Découvrir", url: str("url") } : undefined,
          footer: unsubscribeUrl ? `Vous recevez cet e-mail car vous avez accepté nos actualités. Se désinscrire : ${unsubscribeUrl}` : "Vous recevez cet e-mail car vous avez accepté nos actualités.",
        }),
        unsubscribeUrl,
      };
    }
    default:
      return renderEmail({ subject, heading: subject, paragraphs: [str("body") || ""] });
  }
}

/** Processes up to `batch` pending rows. Called by the worker (and by tests). */
export async function drainEmailOutbox(batch = 20): Promise<{ sent: number; failed: number }> {
  const rows = await db
    .select()
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, "pending"), lt(emailOutbox.attempts, MAX_ATTEMPTS)))
    .orderBy(emailOutbox.createdAt)
    .limit(batch);
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    // Backoff: attempt n waits 2^n minutes since creation/last attempt.
    try {
      const mail = render(row.templateKey, row.subject, row.payload);
      await sendMail({ to: row.toEmail, ...mail });
      await db.update(emailOutbox).set({ status: "sent", sentAt: new Date(), attempts: row.attempts + 1 }).where(eq(emailOutbox.id, row.id));
      sent += 1;
    } catch (err) {
      const attempts = row.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(emailOutbox)
        .set({ attempts, lastError: message.slice(0, 500), status: attempts >= MAX_ATTEMPTS ? "failed" : "pending" })
        .where(eq(emailOutbox.id, row.id));
      logger.warn({ outboxId: row.id, attempts, err: message }, "email send failed");
      failed += 1;
    }
  }
  return { sent, failed };
}

export async function outboxStats() {
  const [r] = await db
    .select({
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
      sent: sql<number>`count(*) filter (where status = 'sent')::int`,
    })
    .from(emailOutbox);
  return r ?? { pending: 0, failed: 0, sent: 0 };
}
