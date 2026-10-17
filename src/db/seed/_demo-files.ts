import { eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { users } from "@/db/schema";
import { logger } from "@/lib/logger";
import type { Actor } from "@/lib/session";
import { createUpload } from "@/modules/files/application/upload-service";
import type { SeedContext } from "./context";

/**
 * Helpers shared by the event seeds to attach real files (quotes, contracts,
 * briefs, message attachments) through the genuine upload pipeline. Every
 * failure (no MinIO, antivirus down, rate limit) is logged and returns null so
 * the seed still completes without files.
 */
/** Standard PDF fonts only encode WinAnsi: replace the few typographic characters the demo texts use. */
function winAnsiSafe(text: string): string {
  return text
    .replace(/→/g, "->")
    .replace(/×/g, "x")
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\u0000-\u00ff€]/g, "");
}

export async function buildDemoPdf(rawTitle: string, rawLines: string[]): Promise<Buffer> {
  const title = winAnsiSafe(rawTitle);
  const lines = rawLines.map(winAnsiSafe);
  const doc = await PDFDocument.create({ updateMetadata: false });
  // Fixed metadata: identical bytes on every run → the pipeline deduplicates inside the event scope.
  const fixed = new Date("2026-02-01T09:00:00.000Z");
  doc.setTitle(title);
  doc.setProducer("Sous Nos Ailes — données de démonstration");
  doc.setCreator("Sous Nos Ailes");
  doc.setCreationDate(fixed);
  doc.setModificationDate(fixed);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  page.drawRectangle({ x: 0, y: 780, width: 595.28, height: 61.89, color: rgb(0.42, 0.56, 0.44) });
  page.drawText("SOUS NOS AILES — DOCUMENT DE DÉMONSTRATION", { x: 40, y: 805, size: 11, font: bold, color: rgb(1, 1, 1) });
  page.drawText(title, { x: 40, y: 730, size: 18, font: bold, color: rgb(0.18, 0.2, 0.22), maxWidth: 515 });
  let y = 690;
  for (const line of lines) {
    page.drawText(line, { x: 40, y, size: 11, font, color: rgb(0.25, 0.27, 0.3), maxWidth: 515 });
    y -= 20;
  }
  page.drawText("Document fictif généré automatiquement. Aucune valeur contractuelle.", { x: 40, y: 60, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
  return Buffer.from(await doc.save());
}

export async function demoActor(ctx: SeedContext, userKey: string): Promise<Actor | null> {
  const userId = ctx.users[userKey];
  if (!userId) return null;
  const [u] = await ctx.db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;
  return { userId: u.id, email: u.email, name: u.name, globalRole: "user", emailVerified: true, isDemo: true };
}

export async function uploadDemoFile(actor: Actor, input: { scope: "event"; scopeId: string; purpose: "quote" | "contract" | "document" | "attachment"; originalName: string; bytes: Buffer }): Promise<string | null> {
  try {
    const res = await createUpload(actor, input, { process: "inline" });
    if (res.status !== "clean") {
      logger.warn({ fileId: res.id, status: res.status, reason: res.rejectionReason }, "seed file not clean");
      return null;
    }
    return res.id;
  } catch (err) {
    logger.warn({ err: (err as Error).message, name: input.originalName }, "seed upload failed");
    return null;
  }
}

export function slugFileName(title: string, ext = "pdf"): string {
  return `${title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}.${ext}`;
}
