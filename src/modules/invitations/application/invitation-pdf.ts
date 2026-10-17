import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { InvitationDetail } from "@/modules/invitations/application/invitation-service";
import { INVITATION_TEMPLATE_META, type InvitationTemplateKey } from "@/modules/invitations/domain/templates";

function safe(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

const A5: [number, number] = [419.53, 595.28];

const PALETTES: Record<InvitationTemplateKey, { bg: [number, number, number]; accent: [number, number, number]; ink: [number, number, number] }> = {
  classic: { bg: [1, 1, 1], accent: [0.42, 0.56, 0.44], ink: [0.18, 0.2, 0.22] },
  rustic: { bg: [0.97, 0.95, 0.9], accent: [0.55, 0.62, 0.45], ink: [0.3, 0.27, 0.22] },
  modern: { bg: [0.12, 0.13, 0.15], accent: [0.95, 0.76, 0.4], ink: [0.98, 0.98, 0.97] },
  kids: { bg: [0.99, 0.95, 0.96], accent: [0.56, 0.72, 0.86], ink: [0.3, 0.3, 0.38] },
};

function formatDate(date: string | null, timezone: string): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: timezone }).format(new Date(`${date}T12:00:00Z`));
}

/** Printable A5 card with optional QR (PNG data URL). The QR never carries personal data. */
export async function renderInvitationPdf(detail: InvitationDetail, qrPngDataUrl: string | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invitation — ${detail.event.name}`);
  doc.setProducer("Sous Nos Ailes");
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const key = (detail.invitation.templateKey in PALETTES ? detail.invitation.templateKey : "classic") as InvitationTemplateKey;
  const pal = PALETTES[key];
  const page = doc.addPage(A5);
  const [w, h] = A5;
  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(...pal.bg) });
  page.drawRectangle({ x: 18, y: 18, width: w - 36, height: h - 36, borderColor: rgb(...pal.accent), borderWidth: key === "modern" ? 4 : 1 });

  const center = (text: string, y: number, size: number, font = serif, color = rgb(...pal.ink)) => {
    page.drawText(text, { x: (w - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color });
  };
  let y = h - 90;
  center(safe(INVITATION_TEMPLATE_META[key].label.toUpperCase()), y, 8, sans, rgb(...pal.accent));
  y -= 40;
  center(safe(detail.event.name), y, 22);
  y -= 34;
  center(safe(`${detail.invitation.recipientName},`), y, 13, serifItalic);
  y -= 22;
  center(safe("vous etes invite(e)"), y, 12);
  const date = detail.invitation.displayOptions.showDate ? formatDate(detail.event.eventDate, detail.event.timezone) : null;
  if (date) {
    y -= 30;
    center(safe(date), y, 11, sans, rgb(...pal.accent));
  }
  if (detail.invitation.displayOptions.showVenue && (detail.event.venueName || detail.event.city)) {
    y -= 16;
    center(safe([detail.event.venueName, detail.event.city].filter(Boolean).join(" — ")), y, 10, sans);
  }
  if (detail.invitation.customMessage) {
    y -= 30;
    const words = safe(detail.invitation.customMessage).split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (serifItalic.widthOfTextAtSize(candidate, 10) > w - 90 && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) lines.push(line);
    for (const l of lines.slice(0, 10)) {
      center(l, y, 10, serifItalic);
      y -= 14;
    }
  }
  if (qrPngDataUrl) {
    const png = await doc.embedPng(Buffer.from(qrPngDataUrl.split(",")[1] ?? "", "base64"));
    const size = 96;
    page.drawImage(png, { x: (w - size) / 2, y: 54, width: size, height: size });
    center(safe("Code d'acces a presenter a l'entree"), 42, 7, sans, rgb(...pal.accent));
  } else {
    center(safe("Repondez via le lien recu ou aupres de l'organisateur"), 48, 8, sans, rgb(...pal.accent));
  }
  return doc.save();
}
