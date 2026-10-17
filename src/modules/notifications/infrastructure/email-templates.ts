import { env } from "@/lib/env";

/**
 * Minimal, accessible HTML e-mail layout. No tracking pixels, no external
 * assets. Content is escaped: templates receive plain strings only.
 */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export type EmailContent = { subject: string; heading: string; paragraphs: string[]; cta?: { label: string; url: string }; footer?: string };

export function renderEmail(content: EmailContent): { subject: string; html: string; text: string } {
  const paragraphsHtml = content.paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#2f3437">${escapeHtml(p)}</p>`).join("");
  const ctaHtml = content.cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(content.cta.url)}" style="display:inline-block;background:#6b8f71;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${escapeHtml(content.cta.label)}</a></p><p style="font-size:13px;color:#6b7280;word-break:break-all">Si le bouton ne fonctionne pas, copiez ce lien : ${escapeHtml(content.cta.url)}</p>`
    : "";
  const footer = content.footer ?? "Vous recevez cet e-mail parce qu'un compte Sous Nos Ailes est associé à cette adresse.";
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f7f4ee;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:16px;padding:32px" cellspacing="0" cellpadding="0">
<tr><td><p style="margin:0 0 24px;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#6b8f71;font-weight:700">Sous Nos Ailes</p>
<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#2f3437">${escapeHtml(content.heading)}</h1>
${paragraphsHtml}${ctaHtml}
<hr style="border:none;border-top:1px solid #e7e2d9;margin:24px 0"><p style="margin:0;font-size:12px;color:#8a8f98">${escapeHtml(footer)}<br>${escapeHtml(env.APP_URL)}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [content.heading, "", ...content.paragraphs, content.cta ? `\n${content.cta.label} : ${content.cta.url}` : "", "", footer].join("\n");
  return { subject: content.subject, html, text };
}
