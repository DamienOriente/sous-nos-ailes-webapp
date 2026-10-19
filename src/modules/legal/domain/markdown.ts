/**
 * Restricted Markdown → block tree. Editorial pages are written by staff but
 * rendered for the public, so no raw HTML is ever interpreted: the renderer
 * only understands headings, paragraphs, lists, emphasis and safe links.
 */
export type InlineNode = { type: "text"; value: string } | { type: "strong"; value: string } | { type: "em"; value: string } | { type: "link"; href: string; label: string };

export type BlockNode =
  | { type: "heading"; level: 2 | 3; id: string; inlines: InlineNode[] }
  | { type: "paragraph"; inlines: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "notice"; inlines: InlineNode[] };

export function slugifyHeading(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const SAFE_HREF = /^(https:\/\/|mailto:|\/(?!\/))/;

export function isSafeHref(href: string): boolean {
  return SAFE_HREF.test(href.trim());
}

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  // link | strong | em — left to right, no nesting (deliberately simple).
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|_([^_]+)_/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) nodes.push({ type: "text", value: text.slice(last, start) });
    if (m[1] !== undefined && m[2] !== undefined) {
      if (isSafeHref(m[2])) nodes.push({ type: "link", href: m[2], label: m[1] });
      else nodes.push({ type: "text", value: m[1] });
    } else if (m[3] !== undefined) {
      nodes.push({ type: "strong", value: m[3] });
    } else if (m[4] !== undefined) {
      nodes.push({ type: "em", value: m[4] });
    }
    last = start + m[0].length;
  }
  if (last < text.length) nodes.push({ type: "text", value: text.slice(last) });
  return nodes;
}

export function parseMarkdown(source: string): BlockNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: BlockNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const usedIds = new Map<string, number>();

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", inlines: parseInline(paragraph.join(" ")) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
      list = null;
    }
  };
  const uniqueId = (base: string) => {
    const n = usedIds.get(base) ?? 0;
    usedIds.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1]?.length === 2 ? 2 : 3;
      const text = heading[2] ?? "";
      blocks.push({ type: "heading", level, id: uniqueId(slugifyHeading(text) || "section"), inlines: parseInline(text) });
      continue;
    }
    const notice = /^>\s?(.*)$/.exec(line);
    if (notice) {
      flushParagraph();
      flushList();
      blocks.push({ type: "notice", inlines: parseInline(notice[1] ?? "") });
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      const item = (bullet?.[1] ?? numbered?.[1] ?? "").trim();
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(item);
      continue;
    }
    // Stray "# Title" lines are demoted: the page title comes from the record.
    flushList();
    paragraph.push(line.replace(/^#\s+/, "").trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Table of contents = level-2 headings. */
export function tableOfContents(blocks: BlockNode[]): Array<{ id: string; label: string }> {
  return blocks
    .filter((b): b is Extract<BlockNode, { type: "heading" }> => b.type === "heading" && b.level === 2)
    .map((b) => ({ id: b.id, label: b.inlines.map((i) => (i.type === "link" ? i.label : i.value)).join("") }));
}
