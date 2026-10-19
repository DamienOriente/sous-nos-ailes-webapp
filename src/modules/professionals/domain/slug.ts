import { slugifyGeo } from "./geo";

/** Slugs that would collide with routes or look like system pages. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(["espace", "admin", "nouveau", "annuaire", "api", "app", "pro", "connexion", "inscription", "onboarding"]);

export function baseSlugFromName(name: string): string {
  const s = slugifyGeo(name).slice(0, 60).replace(/-+$/, "");
  return s.length >= 3 ? s : `pro-${s}`.replace(/-+$/, "");
}

/**
 * Pure uniqueness resolution: `taken` says whether a candidate already exists.
 * Reserved words and collisions get a numeric suffix (-2, -3, …).
 */
export function resolveUniqueSlug(name: string, taken: (candidate: string) => boolean): string {
  const base = baseSlugFromName(name);
  let candidate = RESERVED_SLUGS.has(base) ? `${base}-2` : base;
  let n = 2;
  while (taken(candidate) || RESERVED_SLUGS.has(candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}
