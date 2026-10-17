import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { escapeHtml } from "@/lib/sanitize";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const env = getEnv();
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    ignoreTLS: true,
  });
  return transporter;
}

export type MailInput = {
  to: string;
  subject: string;
  template: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footerNote?: string;
  entityType?: string;
  entityId?: string;
};

function renderText(input: MailInput): string {
  const lines = [input.heading, "", ...input.paragraphs.flatMap((p) => [p, ""])];
  if (input.cta) lines.push(`${input.cta.label} : ${input.cta.url}`, "");
  if (input.footerNote) lines.push(input.footerNote);
  return lines.join("\n");
}

function renderHtml(input: MailInput, brandName: string): string {
  const paragraphs = input.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1f2622;">${escapeHtml(p)}</p>`)
    .join("");
  const cta = input.cta
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(input.cta.url)}" style="display:inline-block;background:#b4603a;color:#f7f2ea;text-decoration:none;padding:12px 20px;border-radius:4px;font-weight:600;">${escapeHtml(input.cta.label)}</a></p>`
    : "";
  const footer = input.footerNote
    ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#5c655f;">${escapeHtml(input.footerNote)}</p>`
    : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:32px 16px;background:#f7f2ea;font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#fbf8f3;border:1px solid #cfdcd2;border-radius:6px;">
<tr><td style="padding:32px;">
<p style="margin:0 0 24px;font-size:14px;letter-spacing:0.02em;color:#3b5447;font-weight:600;">${escapeHtml(brandName)}</p>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:#1f2622;font-weight:600;">${escapeHtml(input.heading)}</h1>
${paragraphs}${cta}${footer}
</td></tr></table>
</td></tr></table>
</body></html>`;
}

/**
 * Sends an email through the local SMTP server (Mailpit) and records it in
 * OutboundEmail. Failures are logged and recorded, never thrown to callers:
 * an email problem must not break a request submission.
 */
export async function sendMail(input: MailInput, brandName = "Les Petits Invités"): Promise<boolean> {
  const env = getEnv();
  const record = await db.outboundEmail.create({
    data: {
      toEmail: input.to,
      subject: input.subject,
      template: input.template,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
  try {
    await getTransporter().sendMail({
      from: env.MAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: renderText(input),
      html: renderHtml(input, brandName),
    });
    await db.outboundEmail.update({ where: { id: record.id }, data: { sentAt: new Date() } });
    log.info("mail.sent", { template: input.template, entityType: input.entityType ?? null });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await db.outboundEmail.update({ where: { id: record.id }, data: { error: message.slice(0, 500) } });
    log.error("mail.failed", { template: input.template, reason: message.slice(0, 200) });
    return false;
  }
}
