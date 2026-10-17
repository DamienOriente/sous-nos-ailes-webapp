import { eq, like, or } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { configurationSettings, editorialPages } from "@/db/schema";
import { DRAFT_NOTICE, LEGAL_DEFAULTS, type LegalSlug } from "@/modules/legal/domain/defaults";
import { parseMarkdown, tableOfContents, type BlockNode } from "@/modules/legal/domain/markdown";
import { isPlaceholderValue, resolveVariables, toLegalVariables, type LegalVariables } from "@/modules/legal/domain/variables";

export type LegalDocument = {
  slug: LegalSlug;
  title: string;
  summary: string | null;
  blocks: BlockNode[];
  toc: Array<{ id: string; label: string }>;
  /** "database" when staff content exists, "default" when the built-in draft is shown. */
  source: "database" | "default";
  status: "draft" | "published";
  /** Variables still equal to a seed placeholder or absent: shown to staff, never hidden. */
  incompleteVariables: string[];
  updatedAt: Date | null;
};

/** `legal.*` and `retention.*` settings are the only ones exposed to documents. */
export async function getLegalVariables(executor: DbExecutor = db): Promise<LegalVariables> {
  const rows = await executor
    .select({ key: configurationSettings.key, value: configurationSettings.value })
    .from(configurationSettings)
    .where(or(like(configurationSettings.key, "legal.%"), like(configurationSettings.key, "retention.%")));
  return toLegalVariables(rows);
}

export async function getLegalDocument(slug: LegalSlug, executor: DbExecutor = db): Promise<LegalDocument> {
  const [row] = await executor.select().from(editorialPages).where(eq(editorialPages.slug, slug)).limit(1);
  const variables = await getLegalVariables(executor);
  const fallback = LEGAL_DEFAULTS[slug];

  const rawBody = row?.body ?? fallback.body;
  const status: "draft" | "published" = row ? row.isPublished : "draft";
  // A draft always carries the warning, even when staff forgot to write it.
  const body = status === "draft" && !rawBody.includes(DRAFT_NOTICE) ? `> ${DRAFT_NOTICE}\n\n${rawBody}` : rawBody;

  const { text, missing } = resolveVariables(body, variables);
  const placeholders = Object.entries(variables)
    .filter(([key, value]) => body.toLowerCase().includes(`{{${key}`) && isPlaceholderValue(value))
    .map(([key]) => key);
  const blocks = parseMarkdown(text);
  return {
    slug,
    title: row?.title ?? fallback.title,
    summary: row ? null : fallback.summary,
    blocks,
    toc: tableOfContents(blocks),
    source: row ? "database" : "default",
    status,
    incompleteVariables: [...new Set([...missing, ...placeholders])].sort(),
    updatedAt: row?.updatedAt ?? null,
  };
}

/** Contact address for the public form; falls back to nothing (form disabled) when unset. */
export async function getContactEmail(executor: DbExecutor = db): Promise<string | null> {
  const [row] = await executor.select({ value: configurationSettings.value }).from(configurationSettings).where(eq(configurationSettings.key, "legal.contact_email")).limit(1);
  const value = row?.value;
  if (typeof value !== "string" || isPlaceholderValue(value) || !value.includes("@")) return null;
  return value;
}
