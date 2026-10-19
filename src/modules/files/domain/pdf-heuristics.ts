import { PDFArray, PDFDict, PDFName, PDFStream, type PDFDocument } from "pdf-lib";

/**
 * Static PDF heuristics (no parsing library): a contractual document must not
 * carry active content. Any of these names in the raw bytes is a rejection.
 * False positives are acceptable (the user gets a clear message); false
 * negatives are what ClamAV + the structure check are for.
 */
export const SUSPICIOUS_PDF_TOKENS = ["/JavaScript", "/JS", "/Launch", "/OpenAction", "/AA", "/EmbeddedFile", "/RichMedia", "/XFA"] as const;

export type PdfHeuristicResult = { ok: true } | { ok: false; token: string };

/**
 * Tokens are matched as PDF names: the token followed by a delimiter
 * (whitespace, "<", "[", "/", "(", ">") so "/JSONData" does not trigger "/JS".
 * The content may also be hex-escaped (#4A for J) — names are normalised first.
 */
export function inspectPdfBytes(buf: Uint8Array): PdfHeuristicResult {
  const text = latin1(buf);
  const normalised = text.replace(/#([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
  for (const token of SUSPICIOUS_PDF_TOKENS) {
    const re = new RegExp(escapeRe(token) + "(?=[\\s<\\[/(>\\]]|$)");
    if (re.test(normalised)) return { ok: false, token };
  }
  return { ok: true };
}

export function looksLikePdf(buf: Uint8Array): boolean {
  // "%PDF-" may be preceded by up to 1024 bytes of junk per the spec.
  const head = latin1(buf.subarray(0, 1024 + 5));
  return head.includes("%PDF-");
}

function latin1(buf: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + CHUNK)));
  }
  return s;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

// ── Structural inspection (parsed document) ─────────────────────────────────
// Raw-byte matching misses names stored inside compressed object streams, so
// the same rules are applied to the parsed object graph (pdf-lib inflates
// object streams on load).
const SUSPICIOUS_KEYS: ReadonlySet<string> = new Set(["JavaScript", "JS", "Launch", "OpenAction", "AA", "EmbeddedFile", "EmbeddedFiles", "RichMedia", "XFA"]);
const SUSPICIOUS_ACTION_TYPES: ReadonlySet<string> = new Set(["JavaScript", "Launch", "RichMediaExecute"]);
const MAX_DEPTH = 8;

export function inspectPdfDocument(doc: PDFDocument): PdfHeuristicResult {
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFStream ? obj.dict : obj instanceof PDFDict ? obj : null;
    if (!dict) continue;
    const hit = inspectDict(dict, 0);
    if (hit) return { ok: false, token: hit };
  }
  return { ok: true };
}

function inspectDict(dict: PDFDict, depth: number): string | null {
  for (const [key, value] of dict.entries()) {
    const name = key.decodeText();
    if (SUSPICIOUS_KEYS.has(name)) return `/${name}`;
    if ((name === "S" || name === "Type") && value instanceof PDFName) {
      const v = value.decodeText();
      if (SUSPICIOUS_ACTION_TYPES.has(v) || v === "EmbeddedFile") return `/${v}`;
    }
    if (depth >= MAX_DEPTH) continue;
    if (value instanceof PDFDict) {
      const hit = inspectDict(value, depth + 1);
      if (hit) return hit;
    } else if (value instanceof PDFArray) {
      for (const el of value.asArray()) {
        if (el instanceof PDFDict) {
          const hit = inspectDict(el, depth + 1);
          if (hit) return hit;
        }
      }
    }
  }
  return null;
}
