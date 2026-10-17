/**
 * Tolerant CSV parser/serialiser (no dependency). Handles BOM, "," or ";"
 * delimiters (auto-detected), quoted fields with doubled quotes, embedded
 * newlines, CRLF. Pure, synchronous, bounded by `maxRows`.
 */
export type ParsedCsv = { headers: string[]; rows: string[][]; delimiter: "," | ";" | "\t"; truncated: boolean; totalRows: number };

export function detectDelimiter(firstLine: string): "," | ";" | "\t" {
  let inQuotes = false;
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "," || ch === ";" || ch === "\t")) counts[ch] += 1;
  }
  if (counts[";"] >= counts[","] && counts[";"] >= counts["\t"]) return counts[";"] > 0 ? ";" : counts["\t"] > 0 ? "\t" : ",";
  return counts[","] >= counts["\t"] ? "," : "\t";
}

export function parseCsv(input: string, options: { maxRows?: number; delimiter?: "," | ";" | "\t" } = {}): ParsedCsv {
  const maxRows = options.maxRows ?? 2000;
  const text = input.replace(/^﻿/, "");
  const firstLineEnd = text.search(/\r?\n/);
  const delimiter = options.delimiter ?? detectDelimiter(firstLineEnd === -1 ? text : text.slice(0, firstLineEnd));

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    // Skip fully empty lines.
    if (!(record.length === 1 && record[0] === "")) records.push(record);
    record = [];
  };
  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      // Normalise CRLF inside quoted fields too.
      if (ch === "\r") {
        i += 1;
        continue;
      }
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRecord();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || record.length > 0) {
    pushField();
    pushRecord();
  }
  const headers = (records.shift() ?? []).map((h) => h.trim());
  const totalRows = records.length;
  const truncated = totalRows > maxRows;
  const rows = (truncated ? records.slice(0, maxRows) : records).map((r) => r.map((c) => c.trim()));
  return { headers, rows, delimiter, truncated, totalRows };
}

function escapeCsvField(value: string, delimiter: string): string {
  if (value === "") return "";
  const needsQuotes = value.includes('"') || value.includes(delimiter) || /[\r\n]/.test(value) || value.startsWith(" ") || value.endsWith(" ");
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

/** Excel-friendly output: UTF-8 BOM, ";" by default (fr-FR locale), CRLF. */
export function serializeCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>, delimiter: "," | ";" = ";"): string {
  const line = (cells: Array<string | number | null | undefined>) => cells.map((c) => escapeCsvField(c === null || c === undefined ? "" : String(c), delimiter)).join(delimiter);
  return `﻿${[line(headers), ...rows.map(line)].join("\r\n")}\r\n`;
}

/** Normalises a header for alias matching: lower-case, no accents, no punctuation. */
export function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Maps CSV headers to known fields through an alias dictionary. Returns the
 * column index for each field (first match wins) and the unmapped headers.
 */
export function mapHeaders<F extends string>(headers: string[], aliases: Record<F, readonly string[]>): { columns: Partial<Record<F, number>>; unmapped: string[] } {
  const columns: Partial<Record<F, number>> = {};
  const unmapped: string[] = [];
  const normalizedAliases = Object.entries(aliases).map(([field, list]) => [field as F, (list as readonly string[]).map(normalizeHeader)] as const);
  headers.forEach((raw, index) => {
    const n = normalizeHeader(raw);
    const hit = normalizedAliases.find(([field, list]) => columns[field] === undefined && list.includes(n));
    if (hit) columns[hit[0]] = index;
    else unmapped.push(raw);
  });
  return { columns, unmapped };
}
