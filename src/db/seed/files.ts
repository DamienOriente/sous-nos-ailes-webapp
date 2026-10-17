import { and, eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { eventDocuments, events, mediaAssets, professionals, users } from "@/db/schema";
import { logger } from "@/lib/logger";
import type { Actor } from "@/lib/session";
import { createUpload } from "@/modules/files/application/upload-service";
import type { SeedContext } from "./context";

/**
 * Demo files: real images (SVG rendered to PNG with sharp) for the demo
 * professionals, uploaded through the real pipeline (policy, antivirus,
 * optimisation), plus synthetic PDF documents for the "Louis & Lisa" wedding.
 * Idempotent: business keys (media kind / document title) are checked first,
 * and the pipeline deduplicates identical bytes inside a scope anyway.
 *
 * Tables written outside the files module: media_assets (pages), event_documents (events).
 */

type Palette = { from: string; to: string; text: string };
const PALETTES: Palette[] = [
  { from: "#6b8f71", to: "#a3b9a6", text: "#ffffff" }, // sauge
  { from: "#e7e2d9", to: "#c9bfae", text: "#2f3437" }, // sable
  { from: "#d9a5a0", to: "#f1d0cc", text: "#2f3437" }, // blush
  { from: "#8fb8cf", to: "#c8dfea", text: "#2f3437" }, // sky
  { from: "#c9a86a", to: "#e6d4a8", text: "#2f3437" }, // gold
];

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] ?? c);
}

function gradientSvg(width: number, height: number, palette: Palette, title: string, subtitle?: string): string {
  const fontSize = Math.round(Math.min(width, height) / 9);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.from}"/><stop offset="1" stop-color="${palette.to}"/></linearGradient></defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <circle cx="${width * 0.82}" cy="${height * 0.22}" r="${Math.min(width, height) * 0.18}" fill="rgba(255,255,255,0.18)"/>
  <circle cx="${width * 0.15}" cy="${height * 0.85}" r="${Math.min(width, height) * 0.25}" fill="rgba(255,255,255,0.12)"/>
  <text x="50%" y="${subtitle ? "48%" : "54%"}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="${palette.text}">${escapeXml(title)}</text>
  ${subtitle ? `<text x="50%" y="62%" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(fontSize * 0.45)}" fill="${palette.text}" opacity="0.85">${escapeXml(subtitle)}</text>` : ""}
</svg>`;
}

async function renderPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

async function renderJpeg(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer();
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

async function buildPdf(title: string, lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  // Deterministic metadata so the same document hashes identically on re-runs.
  const fixed = new Date("2026-01-15T09:00:00.000Z");
  doc.setTitle(title);
  doc.setProducer("Sous Nos Ailes — données de démonstration");
  doc.setCreator("Sous Nos Ailes");
  doc.setCreationDate(fixed);
  doc.setModificationDate(fixed);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]); // A4
  page.drawRectangle({ x: 0, y: 780, width: 595.28, height: 61.89, color: rgb(0.42, 0.56, 0.44) });
  page.drawText("SOUS NOS AILES — DOCUMENT DE DÉMONSTRATION", { x: 40, y: 805, size: 11, font: bold, color: rgb(1, 1, 1) });
  page.drawText(title, { x: 40, y: 730, size: 20, font: bold, color: rgb(0.18, 0.2, 0.22) });
  let y = 690;
  for (const line of lines) {
    page.drawText(line, { x: 40, y, size: 11, font, color: rgb(0.25, 0.27, 0.3), maxWidth: 515 });
    y -= 20;
  }
  page.drawText("Document fictif généré automatiquement. Aucune valeur contractuelle.", { x: 40, y: 60, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function actorFor(ctx: SeedContext, userId: string): Promise<Actor | null> {
  const [u] = await ctx.db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return null;
  return { userId: u.id, email: u.email, name: u.name, globalRole: "user", emailVerified: true, isDemo: true };
}

async function uploadInline(actor: Actor, input: { scope: "professional" | "event"; scopeId: string; purpose: string; originalName: string; bytes: Buffer }): Promise<string | null> {
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

async function seedProfessionalMedia(ctx: SeedContext): Promise<number> {
  let created = 0;
  const keys = Object.keys(ctx.professionals);
  for (const [i, key] of keys.entries()) {
    const professionalId = ctx.professionals[key];
    if (!professionalId) continue;
    const [pro] = await ctx.db.select({ id: professionals.id, ownerUserId: professionals.ownerUserId, displayName: professionals.displayName, city: professionals.city }).from(professionals).where(eq(professionals.id, professionalId)).limit(1);
    if (!pro) continue;
    const actor = await actorFor(ctx, pro.ownerUserId);
    if (!actor) continue;
    const existing = await ctx.db.select({ kind: mediaAssets.kind }).from(mediaAssets).where(eq(mediaAssets.professionalId, pro.id));
    const kinds = new Set(existing.map((e) => e.kind));
    const palette = PALETTES[i % PALETTES.length] ?? PALETTES[0]!;
    const alt = pro.displayName;

    const plan: Array<{ kind: "cover" | "logo" | "gallery"; name: string; bytes: () => Promise<Buffer>; sortOrder: number }> = [];
    if (!kinds.has("cover")) plan.push({ kind: "cover", name: `${key}-cover.jpg`, bytes: () => renderJpeg(gradientSvg(1600, 900, palette, pro.displayName, pro.city ?? undefined)), sortOrder: 0 });
    if (!kinds.has("logo")) plan.push({ kind: "logo", name: `${key}-logo.png`, bytes: () => renderPng(gradientSvg(512, 512, palette, initialsOf(pro.displayName))), sortOrder: 0 });
    if (!kinds.has("gallery")) {
      for (let g = 0; g < 3; g += 1) {
        const p = PALETTES[(i + g + 1) % PALETTES.length] ?? palette;
        plan.push({ kind: "gallery", name: `${key}-galerie-${g + 1}.jpg`, bytes: () => renderJpeg(gradientSvg(1200, 800, p, `Réalisation ${g + 1}`, pro.displayName)), sortOrder: g });
      }
    }
    for (const item of plan) {
      const fileId = await uploadInline(actor, { scope: "professional", scopeId: pro.id, purpose: item.kind, originalName: item.name, bytes: await item.bytes() });
      if (!fileId) continue;
      const [dup] = await ctx.db.select({ id: mediaAssets.id }).from(mediaAssets).where(and(eq(mediaAssets.professionalId, pro.id), eq(mediaAssets.fileId, fileId))).limit(1);
      if (dup) continue;
      await ctx.db.insert(mediaAssets).values({ professionalId: pro.id, fileId, kind: item.kind, alt: item.kind === "gallery" ? `${alt} — réalisation ${item.sortOrder + 1}` : alt, sortOrder: item.sortOrder });
      created += 1;
    }
  }
  return created;
}

async function seedEventDocuments(ctx: SeedContext): Promise<number> {
  const eventId = ctx.events.louisLisa;
  if (!eventId) return 0;
  const [ev] = await ctx.db.select({ id: events.id, ownerUserId: events.ownerUserId, name: events.name }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!ev) return 0;
  const actor = await actorFor(ctx, ev.ownerUserId);
  if (!actor) return 0;
  const existing = await ctx.db.select({ title: eventDocuments.title }).from(eventDocuments).where(eq(eventDocuments.eventId, ev.id));
  const titles = new Set(existing.map((e) => e.title));

  const docs: Array<{ title: string; kind: "quote" | "contract"; purpose: "quote" | "contract"; visibility: string; lines: string[] }> = [
    {
      title: "Devis garde d'enfants — Marie Delcourt",
      kind: "quote",
      purpose: "quote",
      visibility: "organizers",
      lines: ["Évènement : Mariage de Louis et Lisa — 12 juin 2027", "Prestation : garde d'enfants évènementielle, 2 intervenantes, 14h-01h", "Enfants attendus : 12 (3 à 10 ans)", "Montant : 1 180,00 € TTC", "Acompte 30 % à la signature, solde J-7."],
    },
    {
      title: "Contrat traiteur — Julien Rossi",
      kind: "contract",
      purpose: "contract",
      visibility: "organizers",
      lines: ["Évènement : Mariage de Louis et Lisa — 12 juin 2027", "Cocktail 18h30 puis dîner assis 120 couverts, menu enfants ×12", "Montant : 9 600,00 € TTC", "Conditions : annulation sans frais jusqu'à J-60.", "Signé électroniquement le 15 janvier 2026 (démonstration)."],
    },
    {
      title: "Devis domaine — Hélène Vasseur",
      kind: "quote",
      purpose: "quote",
      visibility: "team",
      lines: ["Location du domaine du vendredi 11 juin 16h au dimanche 13 juin 12h", "Salle de réception, parc, 6 chambres, office traiteur", "Montant : 6 400,00 € TTC", "Option : espace enfants avec accès sécurisé (inclus)."],
    },
  ];

  let created = 0;
  for (const d of docs) {
    if (titles.has(d.title)) continue;
    const bytes = await buildPdf(d.title, d.lines);
    const fileId = await uploadInline(actor, { scope: "event", scopeId: ev.id, purpose: d.purpose, originalName: `${d.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.pdf`, bytes });
    if (!fileId) continue;
    await ctx.db.insert(eventDocuments).values({ eventId: ev.id, fileId, title: d.title, kind: d.kind, visibility: d.visibility, uploadedByUserId: actor.userId });
    created += 1;
  }
  return created;
}

export async function seed(ctx: SeedContext): Promise<void> {
  const media = await seedProfessionalMedia(ctx);
  const docs = await seedEventDocuments(ctx);
  process.stdout.write(`files: ${media} media assets, ${docs} event documents created\n`);
}
