import { and, eq, inArray } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { eventDocuments, events, files, mediaAssets, professionalCategories, professionals, profileVersions, publicProfiles, users } from "@/db/schema";
import { logger } from "@/lib/logger";
import type { Actor } from "@/lib/session";
import { createUpload } from "@/modules/files/application/upload-service";
import { CATEGORY_PHOTO_THEMES, photosByTheme, unsplashUrl, type DemoPhoto } from "@/modules/media/demo-photos";
import { bindMediaToContent, type MediaLibrary } from "@/modules/pages/domain/media-binding";
import { parseContent } from "@/modules/pages/domain/page-schema";
import type { SeedContext } from "./context";

/**
 * Demo files for the fictitious professionals: real photographs from the demo
 * catalogue (Unsplash, downloaded at seed time) for the cover and the gallery,
 * a generated monogram logo, plus synthetic PDF documents for the "Louis &
 * Lisa" wedding. Everything goes through the real upload pipeline (policy,
 * antivirus, EXIF stripping, WebP variants).
 *
 * Idempotent: every planned picture has a business key (the `files.original_name`,
 * which embeds the catalogue photo id) checked before any download; identical
 * bytes are deduplicated by the pipeline (sha256 per scope). When the network
 * is unavailable the seed falls back to generated gradients so the pages are
 * never empty, and replaces them by photographs on the next online run.
 *
 * Tables written outside the files module: media_assets, profile_versions.content
 * (pages: hero/about/gallery references), event_documents (events).
 */

type Palette = { from: string; to: string; text: string };
const PALETTES: Palette[] = [
  { from: "#6b8f71", to: "#a3b9a6", text: "#ffffff" }, // sauge
  { from: "#e7e2d9", to: "#c9bfae", text: "#2f3437" }, // sable
  { from: "#d9a5a0", to: "#f1d0cc", text: "#2f3437" }, // blush
  { from: "#8fb8cf", to: "#c8dfea", text: "#2f3437" }, // sky
  { from: "#c9a86a", to: "#e6d4a8", text: "#2f3437" }, // gold
];

const DOWNLOAD_BATCH = 6;
const DOWNLOAD_TIMEOUT_MS = 15_000;

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

/** Monogram logo: initials set in the palette, a thin ring, flat colour (reads well at 48 px). */
function monogramSvg(size: number, palette: Palette, initials: string): string {
  const r = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${palette.from}"/>
  <circle cx="${r}" cy="${r}" r="${r * 0.72}" fill="none" stroke="${palette.text}" stroke-opacity="0.35" stroke-width="${size * 0.012}"/>
  <text x="50%" y="50%" dy="${size * 0.13}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="600" font-size="${Math.round(size * (initials.length > 1 ? 0.36 : 0.44))}" letter-spacing="${size * 0.01}" fill="${palette.text}">${escapeXml(initials)}</text>
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
    .split(/[\s—–-]+/)
    .filter((p) => p && !/^(de|du|des|la|le|les|et|&)$/i.test(p))
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

// ── Photo plan ──────────────────────────────────────────────────────────────
/**
 * Distinct catalogue photos for a category, rotated by `offset` so two
 * listings of the same trade do not share the same cover. Deterministic.
 */
function photoPlan(categorySlug: string, offset: number, count: number): DemoPhoto[] {
  const themes = CATEGORY_PHOTO_THEMES[categorySlug] ?? ["reception"];
  const pools = themes.map((t) => photosByTheme(t)).filter((p) => p.length > 0);
  const all: DemoPhoto[] = [];
  const seen = new Set<string>();
  for (let round = 0; all.length < 40 && round < 12; round += 1) {
    for (const pool of pools) {
      const p = pool[round];
      if (p && !seen.has(p.id)) {
        seen.add(p.id);
        all.push(p);
      }
    }
  }
  if (all.length === 0) return [];
  const start = offset % all.length;
  return Array.from({ length: Math.min(count, all.length) }, (_, i) => all[(start + i) % all.length]!);
}

type DownloadResult = Map<string, Buffer | null>;

/** Downloads the catalogue photos in parallel batches; a failed download is null (fallback to generated visuals). */
async function downloadPhotos(ids: string[]): Promise<DownloadResult> {
  const out: DownloadResult = new Map();
  const unique = Array.from(new Set(ids));
  for (let i = 0; i < unique.length; i += DOWNLOAD_BATCH) {
    const batch = unique.slice(i, i + DOWNLOAD_BATCH);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const res = await fetch(unsplashUrl(id, { w: 2000, q: 80 }), { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS), headers: { accept: "image/jpeg,image/*;q=0.8" } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = Buffer.from(await res.arrayBuffer());
          // The pipeline detects the real type from magic bytes; make sure we got an image and not an HTML error page.
          const meta = await sharp(buf).metadata();
          if (!meta.format || !meta.width) throw new Error("not an image");
          return [id, buf] as const;
        } catch (err) {
          logger.warn({ id, err: (err as Error).message }, "demo photo download failed, falling back to generated visual");
          return [id, null] as const;
        }
      }),
    );
    for (const [id, buf] of results) out.set(id, buf);
  }
  return out;
}

type PlannedPicture = { kind: "cover" | "gallery"; photo: DemoPhoto; name: string; alt: string; caption: string; sortOrder: number };

function picturesFor(key: string, displayName: string, categorySlug: string, offset: number, galleryCount: number): PlannedPicture[] {
  const photos = photoPlan(categorySlug, offset, galleryCount + 1);
  return photos.map((photo, i) =>
    i === 0
      ? { kind: "cover", photo, name: `${key}-cover-${photo.id}.jpg`, alt: `${displayName} — ${photo.alt} (photo de démonstration)`, caption: photo.alt, sortOrder: 0 }
      : { kind: "gallery", photo, name: `${key}-galerie-${photo.id}.jpg`, alt: `${displayName} — ${photo.alt} (photo de démonstration)`, caption: photo.alt, sortOrder: i - 1 },
  );
}

async function ensureMediaAsset(ctx: SeedContext, professionalId: string, fileId: string, kind: string, alt: string, caption: string | null, sortOrder: number): Promise<boolean> {
  const [dup] = await ctx.db.select({ id: mediaAssets.id }).from(mediaAssets).where(and(eq(mediaAssets.professionalId, professionalId), eq(mediaAssets.fileId, fileId))).limit(1);
  if (dup) {
    await ctx.db.update(mediaAssets).set({ kind, alt, caption, sortOrder }).where(eq(mediaAssets.id, dup.id));
    return false;
  }
  await ctx.db.insert(mediaAssets).values({ professionalId, fileId, kind, alt, caption, sortOrder });
  return true;
}

async function seedProfessionalMedia(ctx: SeedContext): Promise<{ created: number; photos: number; generated: number }> {
  const stats = { created: 0, photos: 0, generated: 0 };
  const keys = Object.keys(ctx.professionals);
  const pros: Array<{ key: string; id: string; ownerUserId: string; displayName: string; city: string | null; status: string; categorySlug: string; index: number }> = [];
  for (const [index, key] of keys.entries()) {
    const professionalId = ctx.professionals[key];
    if (!professionalId) continue;
    const [row] = await ctx.db
      .select({ id: professionals.id, ownerUserId: professionals.ownerUserId, displayName: professionals.displayName, city: professionals.city, status: professionals.status, categorySlug: professionalCategories.slug })
      .from(professionals)
      .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
      .where(eq(professionals.id, professionalId))
      .limit(1);
    if (row) pros.push({ key, index, ...row });
  }

  // 1. plan every picture, 2. find what already exists, 3. download only what is missing.
  const plans = new Map<string, PlannedPicture[]>();
  for (const pro of pros) {
    // Spread the covers: trades sharing a theme (childcare, baby-sitting, animation) must not all open on the same photo.
    const offset = pro.index * 5;
    const galleryCount = pro.status === "published" ? 4 + (pro.index % 3) : 2; // 4–6 for published, 2 for drafts
    plans.set(pro.key, picturesFor(pro.key, pro.displayName, pro.categorySlug, offset, galleryCount));
  }
  const existingByPro = new Map<string, Map<string, string>>();
  const missingPhotoIds: string[] = [];
  for (const pro of pros) {
    const rows = await ctx.db.select({ id: files.id, originalName: files.originalName }).from(files).where(and(eq(files.scope, "professional"), eq(files.scopeId, pro.id), eq(files.status, "clean")));
    const byName = new Map(rows.map((r) => [r.originalName, r.id]));
    existingByPro.set(pro.key, byName);
    for (const p of plans.get(pro.key) ?? []) if (!byName.has(p.name)) missingPhotoIds.push(p.photo.id);
  }
  const downloads = missingPhotoIds.length > 0 ? await downloadPhotos(missingPhotoIds) : new Map<string, Buffer | null>();
  const online = Array.from(downloads.values()).some((b) => b !== null);
  if (missingPhotoIds.length > 0 && !online) logger.warn("no demo photo could be downloaded: generated visuals will be used");

  for (const pro of pros) {
    const actor = await actorFor(ctx, pro.ownerUserId);
    if (!actor) continue;
    const byName = existingByPro.get(pro.key) ?? new Map<string, string>();
    const palette = PALETTES[pro.index % PALETTES.length] ?? PALETTES[0]!;
    const plan = plans.get(pro.key) ?? [];
    const photoNames = new Set(plan.map((p) => p.name));
    const gotPhoto: Record<"cover" | "gallery", boolean> = { cover: false, gallery: false };

    for (const item of plan) {
      let fileId = byName.get(item.name) ?? null;
      if (!fileId) {
        const bytes = downloads.get(item.photo.id);
        if (!bytes) continue;
        fileId = await uploadInline(actor, { scope: "professional", scopeId: pro.id, purpose: item.kind, originalName: item.name, bytes });
        if (!fileId) continue;
        stats.photos += 1;
      }
      gotPhoto[item.kind] = true;
      if (await ensureMediaAsset(ctx, pro.id, fileId, item.kind, item.alt, item.caption, item.sortOrder)) stats.created += 1;
    }

    // Logo: generated monogram, always (no photograph could honestly stand for a logo).
    const logoName = `${pro.key}-logo.png`;
    let logoId = byName.get(logoName) ?? null;
    if (!logoId) {
      logoId = await uploadInline(actor, { scope: "professional", scopeId: pro.id, purpose: "logo", originalName: logoName, bytes: await renderPng(monogramSvg(512, palette, initialsOf(pro.displayName))) });
      if (logoId) stats.generated += 1;
    }
    if (logoId && (await ensureMediaAsset(ctx, pro.id, logoId, "logo", `${pro.displayName} — monogramme`, null, 0))) stats.created += 1;

    // Fallback (offline): generated gradients, only for the kinds without a single photograph.
    const fallback: Array<{ kind: "cover" | "gallery"; name: string; bytes: () => Promise<Buffer>; sortOrder: number; alt: string }> = [];
    if (!gotPhoto.cover) fallback.push({ kind: "cover", name: `${pro.key}-cover-generated.jpg`, bytes: () => renderJpeg(gradientSvg(1600, 900, palette, pro.displayName, pro.city ?? undefined)), sortOrder: 0, alt: `${pro.displayName} (visuel généré)` });
    if (!gotPhoto.gallery) {
      for (let g = 0; g < 3; g += 1) {
        const p = PALETTES[(pro.index + g + 1) % PALETTES.length] ?? palette;
        fallback.push({ kind: "gallery", name: `${pro.key}-galerie-generated-${g + 1}.jpg`, bytes: () => renderJpeg(gradientSvg(1200, 800, p, `Réalisation ${g + 1}`, pro.displayName)), sortOrder: g, alt: `${pro.displayName} — réalisation ${g + 1} (visuel généré)` });
      }
    }
    for (const item of fallback) {
      let fileId = byName.get(item.name) ?? null;
      if (!fileId) {
        fileId = await uploadInline(actor, { scope: "professional", scopeId: pro.id, purpose: item.kind, originalName: item.name, bytes: await item.bytes() });
        if (fileId) stats.generated += 1;
      }
      if (fileId && (await ensureMediaAsset(ctx, pro.id, fileId, item.kind, item.alt, null, item.sortOrder))) stats.created += 1;
    }

    // Converge: once real photographs exist for a kind, drop the generated/legacy assets of that kind.
    const assets = await ctx.db
      .select({ id: mediaAssets.id, kind: mediaAssets.kind, originalName: files.originalName })
      .from(mediaAssets)
      .innerJoin(files, eq(files.id, mediaAssets.fileId))
      .where(eq(mediaAssets.professionalId, pro.id));
    const stale = assets.filter((a) => (a.kind === "cover" || a.kind === "gallery") && gotPhoto[a.kind] && !photoNames.has(a.originalName)).map((a) => a.id);
    if (stale.length) await ctx.db.delete(mediaAssets).where(inArray(mediaAssets.id, stale));
  }
  return stats;
}

/** Points the hero, the about picture and the gallery of every page version to the media library. */
async function syncPageMedia(ctx: SeedContext): Promise<number> {
  let updated = 0;
  for (const professionalId of Object.values(ctx.professionals)) {
    const assets = await ctx.db
      .select({ fileId: mediaAssets.fileId, kind: mediaAssets.kind, alt: mediaAssets.alt, caption: mediaAssets.caption, sortOrder: mediaAssets.sortOrder })
      .from(mediaAssets)
      .innerJoin(files, eq(files.id, mediaAssets.fileId))
      .where(and(eq(mediaAssets.professionalId, professionalId), eq(files.status, "clean")))
      .orderBy(mediaAssets.sortOrder);
    const cover = assets.find((a) => a.kind === "cover") ?? null;
    const library: MediaLibrary = { cover: cover ? { fileId: cover.fileId, alt: cover.alt } : null, gallery: assets.filter((a) => a.kind === "gallery").map((a) => ({ fileId: a.fileId, alt: a.alt, caption: a.caption })) };
    if (!library.cover && library.gallery.length === 0) continue;
    const [profile] = await ctx.db.select({ id: publicProfiles.id }).from(publicProfiles).where(eq(publicProfiles.professionalId, professionalId)).limit(1);
    if (!profile) continue;
    const versions = await ctx.db.select({ id: profileVersions.id, content: profileVersions.content }).from(profileVersions).where(eq(profileVersions.publicProfileId, profile.id));
    for (const v of versions) {
      const parsed = parseContent(v.content);
      if (!parsed.ok) continue;
      const bound = bindMediaToContent(parsed.value, library);
      if (JSON.stringify(bound) === JSON.stringify(parsed.value)) continue;
      await ctx.db.update(profileVersions).set({ content: bound, updatedAt: ctx.now }).where(eq(profileVersions.id, v.id));
      updated += 1;
    }
  }
  return updated;
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
  const pages = await syncPageMedia(ctx);
  const docs = await seedEventDocuments(ctx);
  process.stdout.write(`files: ${media.created} media assets created (${media.photos} photos downloaded, ${media.generated} generated), ${pages} page versions bound, ${docs} event documents created\n`);
}
