import { z } from "zod";

export const PAGE_SIZE = 24;

/** Query string → typed filters. Unknown/invalid values fall back to defaults instead of erroring. */
export const searchParamsSchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  category: z.string().trim().max(80).optional().default(""),
  department: z.string().trim().max(80).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  radius: z.coerce.number().int().min(0).max(300).optional().default(0),
  eventType: z.string().trim().max(40).optional().default(""),
  priceMax: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  priceMin: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  children: z.enum(["1", ""]).optional().default(""),
  languages: z.string().trim().max(60).optional().default(""),
  verification: z.coerce.number().int().min(0).max(5).optional().default(0),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).default(""),
  favorites: z.enum(["1", ""]).optional().default(""),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
});
export type SearchFilters = z.infer<typeof searchParamsSchema>;

export function parseSearchParams(raw: Record<string, string | string[] | undefined>): SearchFilters {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined) flat[k] = val;
  }
  const parsed = searchParamsSchema.safeParse(flat);
  if (parsed.success) return parsed.data;
  // Partial recovery: drop invalid keys and re-parse.
  const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
  for (const k of bad) delete flat[k];
  return searchParamsSchema.parse(flat);
}

/** Rebuilds a query string from filters (drops defaults for clean URLs). */
export function toQueryString(filters: Partial<SearchFilters>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === "" || v === 0 || (k === "page" && v === 1)) continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function languagesFromFilter(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
}
