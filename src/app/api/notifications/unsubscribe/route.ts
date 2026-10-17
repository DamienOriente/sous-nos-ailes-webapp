import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { updateNotificationPreferences } from "@/modules/notifications/application/notification-service";
import { verifyMarketingUnsubscribeToken } from "@/modules/notifications/application/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const query = z.object({ u: z.string().min(1).max(64), t: z.string().length(64) });

function page(title: string, body: string, status: number): NextResponse {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} — Sous Nos Ailes</title></head><body style="margin:0;background:#f7f4ee;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2f3437"><main style="max-width:520px;margin:64px auto;padding:32px;background:#fff;border-radius:16px"><p style="margin:0 0 16px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b8f71;font-weight:700">Sous Nos Ailes</p><h1 style="font-size:22px;margin:0 0 12px">${title}</h1><p style="line-height:1.6">${body}</p></main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}

/**
 * One-click marketing opt-out (GET for mail clients, POST for RFC 8058
 * List-Unsubscribe=One-Click). No session: the HMAC token authenticates the
 * request. Transactional e-mails are not affected.
 */
async function handle(request: Request) {
  const url = new URL(request.url);
  const parsed = query.safeParse({ u: url.searchParams.get("u"), t: url.searchParams.get("t") });
  if (!parsed.success || !verifyMarketingUnsubscribeToken(parsed.data.u, parsed.data.t)) {
    return page("Lien invalide", "Ce lien de désinscription n'est pas valide ou a expiré. Vous pouvez gérer vos préférences depuis votre compte.", 400);
  }
  try {
    await updateNotificationPreferences(parsed.data.u, { marketingEmails: false });
  } catch (err) {
    logger.error({ err }, "unsubscribe failed");
    return page("Erreur", "Nous n'avons pas pu enregistrer votre demande. Réessayez plus tard.", 500);
  }
  return page("Désinscription enregistrée", "Vous ne recevrez plus nos e-mails d'actualités. Les e-mails liés à vos évènements et à votre compte continuent de vous être envoyés.", 200);
}

export const GET = handle;
export const POST = handle;
