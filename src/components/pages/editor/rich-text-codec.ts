import type { Inline, RichText } from "@/modules/pages/domain/page-schema";

/**
 * The "À propos" editor is a plain textarea with a tiny markup: blank line =
 * new paragraph, lines starting with "- " = list, "1. " = ordered list,
 * **bold** and _italic_. This is converted to the JSON rich-text tree before
 * saving, so no markup (and no HTML) is ever stored.
 */
export function parseInline(text: string): Inline[] {
  const runs: Inline[] = [];
  const re = /(\*\*([^*]+)\*\*)|(_([^_]+)_)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) runs.push({ text: text.slice(last, idx) });
    if (m[2] !== undefined) runs.push({ text: m[2], bold: true });
    else if (m[4] !== undefined) runs.push({ text: m[4], italic: true });
    last = idx + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length > 0 ? runs : [{ text }];
}

export function textToRichText(input: string): RichText {
  const out: RichText = [];
  const chunks = input.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const bullet = lines.every((l) => /^[-•]\s+/.test(l));
    const ordered = lines.every((l) => /^\d+[.)]\s+/.test(l));
    if (bullet || ordered) {
      out.push({ type: "list", ordered, items: lines.map((l) => parseInline(l.replace(/^([-•]|\d+[.)])\s+/, ""))) });
    } else {
      out.push({ type: "paragraph", children: parseInline(lines.join(" ")) });
    }
  }
  return out;
}

function inlineToText(runs: Inline[]): string {
  return runs.map((r) => (r.bold ? `**${r.text}**` : r.italic ? `_${r.text}_` : r.text)).join("");
}

export function richTextToText(body: RichText): string {
  return body
    .map((b) => (b.type === "paragraph" ? inlineToText(b.children) : b.items.map((it, i) => `${b.ordered ? `${i + 1}. ` : "- "}${inlineToText(it)}`).join("\n")))
    .join("\n\n");
}
