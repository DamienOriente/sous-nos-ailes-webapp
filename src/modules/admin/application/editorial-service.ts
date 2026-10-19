import { asc, eq } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { editorialPages } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireGlobalPermission } from "@/modules/authorization";
import { DRAFT_NOTICE, LEGAL_DEFAULTS, LEGAL_SLUGS, type LegalSlug } from "@/modules/legal/domain/defaults";
import { parseMarkdown, type BlockNode } from "@/modules/legal/domain/markdown";
import { extractVariables, resolveVariables } from "@/modules/legal/domain/variables";
import { getLegalVariables } from "@/modules/legal/application/legal-pages";
import { recordAudit } from "@/modules/admin/application/audit";

/**
 * Back-office CRUD for editorial pages. Rendering and defaults belong to the
 * legal module (restricted Markdown, `{{legal.*}}` variables); this service
 * only validates and stores what staff write.
 */
export const EDITORIAL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_BODY_LENGTH = 60_000;

/** Pages the site links to and expects to exist (footer, FAQ, pricing). */
export const EXPECTED_EDITORIAL_SLUGS: readonly string[] = [...LEGAL_SLUGS, "classements-sponsorises", "faq", "accessibilite", "a-propos"];

export type EditorialValidation = { ok: true; variables: string[] } | { ok: false; message: string };

/** No raw HTML, no javascript: links, known variables only. */
export function validateEditorialBody(body: string): EditorialValidation {
  if (body.length > MAX_BODY_LENGTH) return { ok: false, message: `Contenu trop long (${MAX_BODY_LENGTH} caractères max).` };
  if (/<\s*\/?\s*[a-z!][^>]*>/i.test(body)) return { ok: false, message: "Le HTML n'est pas autorisé : utilisez la syntaxe restreinte (titres ##, listes -, **gras**, _italique_, [lien](https://…))." };
  if (/\]\(\s*(javascript|data|vbscript):/i.test(body)) return { ok: false, message: "Lien non autorisé (seuls https://, mailto: et les chemins internes sont acceptés)." };
  const variables = extractVariables(body);
  const unknown = variables.filter((v) => !v.startsWith("legal.") && !v.startsWith("retention."));
  if (unknown.length) return { ok: false, message: `Variables inconnues : ${unknown.join(", ")} (seules {{legal.*}} et {{retention.*}} sont résolues).` };
  return { ok: true, variables };
}

export async function listEditorialPages(actor: Actor) {
  requireGlobalPermission(actor, "admin.content.manage");
  const rows = await db.select().from(editorialPages).orderBy(asc(editorialPages.slug));
  const missing = EXPECTED_EDITORIAL_SLUGS.filter((s) => !rows.some((r) => r.slug === s));
  return { pages: rows, missing };
}

export async function getEditorialPage(actor: Actor, slug: string) {
  requireGlobalPermission(actor, "admin.content.manage");
  const [row] = await db.select().from(editorialPages).where(eq(editorialPages.slug, slug)).limit(1);
  if (row) return row;
  const fallback = (LEGAL_SLUGS as readonly string[]).includes(slug) ? LEGAL_DEFAULTS[slug as LegalSlug] : null;
  if (!fallback) throw new NotFoundError();
  return { slug, title: fallback.title, body: fallback.body, isPublished: "draft" as const, updatedByUserId: null, createdAt: null, updatedAt: null };
}

export type EditorialInput = { slug: string; title: string; body: string; isPublished: "draft" | "published" };

export async function saveEditorialPage(actor: Actor, input: EditorialInput, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(actor, "admin.content.manage");
  const slug = input.slug.trim().toLowerCase();
  if (!EDITORIAL_SLUG_PATTERN.test(slug) || slug.length > 80) throw new ValidationError("Slug invalide (minuscules, chiffres et tirets).");
  if (input.title.trim().length < 3) throw new ValidationError("Titre trop court.");
  const check = validateEditorialBody(input.body);
  if (!check.ok) throw new ValidationError(check.message);
  const [existing] = await executor.select({ isPublished: editorialPages.isPublished }).from(editorialPages).where(eq(editorialPages.slug, slug)).limit(1);
  await executor
    .insert(editorialPages)
    .values({ slug, title: input.title.trim(), body: input.body, isPublished: input.isPublished, updatedByUserId: actor.userId })
    .onConflictDoUpdate({ target: editorialPages.slug, set: { title: input.title.trim(), body: input.body, isPublished: input.isPublished, updatedByUserId: actor.userId } });
  await recordAudit(executor, { actorUserId: actor.userId, action: existing ? "admin.editorial.updated" : "admin.editorial.created", resourceType: "editorial_page", resourceId: slug, metadata: { isPublished: input.isPublished, wasPublished: existing?.isPublished ?? null, variables: check.variables } });
}

/** Rendered preview with the current legal variables (what the public will see). */
export async function previewEditorial(body: string, executor: DbExecutor = db): Promise<{ blocks: BlockNode[]; missing: string[] }> {
  const variables = await getLegalVariables(executor);
  const { text, missing } = resolveVariables(body, variables);
  return { blocks: parseMarkdown(text), missing };
}

/**
 * Published page for public routes owned by this module (e.g. /classements-sponsorises).
 * Draft pages are not served; a published page keeps its draft notice if staff left it.
 */
export async function getPublishedEditorialPage(slug: string, executor: DbExecutor = db): Promise<{ slug: string; title: string; blocks: BlockNode[]; hasDraftNotice: boolean; updatedAt: Date } | null> {
  const [row] = await executor.select().from(editorialPages).where(eq(editorialPages.slug, slug)).limit(1);
  if (!row || row.isPublished !== "published") return null;
  const variables = await getLegalVariables(executor);
  const { text } = resolveVariables(row.body, variables);
  return { slug: row.slug, title: row.title, blocks: parseMarkdown(text), hasDraftNotice: row.body.includes(DRAFT_NOTICE), updatedAt: row.updatedAt };
}
