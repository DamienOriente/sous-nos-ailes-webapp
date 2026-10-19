/**
 * Legal documents reference editor data through `{{legal.key}}` variables so
 * the texts never hard-code an address, a SIRET or a name that the owner has
 * not provided. Unknown or missing values render as a visible placeholder.
 */
export const VARIABLE_PATTERN = /\{\{\s*([a-z0-9_.-]+)\s*\}\}/gi;

export const MISSING_PLACEHOLDER = "[À COMPLÉTER]";

export type LegalVariables = Record<string, string>;

export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(VARIABLE_PATTERN)) {
    const key = m[1];
    if (key) found.add(key.toLowerCase());
  }
  return [...found].sort();
}

/** Replaces every variable; a missing value becomes the explicit placeholder so nothing is silently invented. */
export function resolveVariables(body: string, variables: LegalVariables): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = body.replace(VARIABLE_PATTERN, (_, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const value = variables[key];
    if (value === undefined || value.trim() === "") {
      missing.add(key);
      return MISSING_PLACEHOLDER;
    }
    return value;
  });
  return { text, missing: [...missing].sort() };
}

/** Configuration values are stored as JSON; only strings and numbers are usable in a document. */
export function toLegalVariables(rows: ReadonlyArray<{ key: string; value: unknown }>): LegalVariables {
  const out: LegalVariables = {};
  for (const row of rows) {
    if (typeof row.value === "string") out[row.key.toLowerCase()] = row.value;
    else if (typeof row.value === "number") out[row.key.toLowerCase()] = String(row.value);
  }
  return out;
}

/** True when the value is still one of the seed placeholders ("[... À COMPLÉTER]"). */
export function isPlaceholderValue(value: string): boolean {
  return /^\[.*À COMPLÉTER.*\]$/u.test(value.trim());
}
