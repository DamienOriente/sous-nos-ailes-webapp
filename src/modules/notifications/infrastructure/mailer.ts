import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Transactional e-mail transport (SMTP: Brevo relay in production, Mailpit locally).
 * Marketing e-mails never go through here; they require a separate opt-in flow.
 */
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" } : undefined,
  connectionTimeout: 10_000,
});

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** List-Unsubscribe is only relevant for optional notifications. */
  unsubscribeUrl?: string;
};

export async function sendMail(message: MailMessage): Promise<{ messageId: string }> {
  const info = await transporter.sendMail({
    from: env.MAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    headers: message.unsubscribeUrl ? { "List-Unsubscribe": `<${message.unsubscribeUrl}>` } : undefined,
  });
  logger.info({ messageId: info.messageId, template: message.subject.slice(0, 40) }, "mail sent");
  return { messageId: info.messageId };
}

export async function verifyMailTransport(): Promise<boolean> {
  try {
    await transporter.verify();
    return true;
  } catch (err) {
    logger.warn({ err }, "smtp transport not reachable");
    return false;
  }
}
