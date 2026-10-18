import { and, asc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { configurationSettings, featuredPlacements, mediaAssets, professionalCategories, professionalFavorites, professionalServices, professionals } from "@/db/schema";
import { findCity, findDepartmentBySlug, findDepartmentByCode, departmentCentroid, haversineKm, slugifyGeo } from "@/modules/professionals/domain/geo";
import { compareRanked, scoreListing } from "@/modules/professionals/domain/ranking";
import { languagesFromFilter, PAGE_SIZE, type SearchFilters } from "@/modules/directory/domain/search-params";
import { isPublicListing } from "@/modules/directory/application/public-listing";

/** Candidate pool scanned before in-memory ranking. Fine for V1 volumes; revisit with a SQL ranking when > a few thousand published listings. */
const CANDIDATE_LIMIT = 600;

export type DirectoryCard = {
  id: string;
  slug: string;
  displayName: string;
  tagline: string | null;
  city: string | null;
  department: string | null;
  departmentName: string | null;
  categoryName: string;
  categorySlug: string;
  priceFromCents: number | null;
  priceToCents: number | null;
  priceUnit: string | null;
  verificationLevel: number;
  averageRating: number | null;
  reviewCount: number;
  acceptsChildrenServices: boolean;
  isDemo: boolean;
  coverFileId: string | null;
  topServices: string[];
  distanceKm: number | null;
  isFavorite: boolean;
  score: number;
};

export type DirectoryResult = {
  items: DirectoryCard[];
  sponsored: DirectoryCard[];
  total: number;
  page: number;
  pageCount: number;
  /** Where the distance is measured from (resolved city or department centroid). */
  origin: { label: string; latitude: number; longitude: number } | null;
  category: { slug: string; name: string; description: string | null; isChildcare: boolean } | null;
  departmentName: string | null;
};

type Candidate = {
  id: string;
  slug: string;
  displayName: string;
  tagline: string | null;
  city: string | null;
  department: string | null;
  latitude: number | null;
  longitude: number | null;
  interventionRadiusKm: number;
  priceFromCents: number | null;
  priceToCents: number | null;
  priceUnit: string | null;
  verificationLevel: number;
  completenessScore: number;
  averageRating: number | null;
  reviewCount: number;
  acceptsChildrenServices: boolean;
  eventTypes: string[];
  isDemo: boolean;
  primaryCategoryId: string;
  categoryName: string;
  categorySlug: string;
  textMatch: boolean;
  secondaryMatch: boolean;
  availableOnDate: boolean | null;
};

function resolveOrigin(filters: SearchFilters): DirectoryResult["origin"] {
  if (filters.city) {
    const c = findCity(filters.city);
    if (c) return { label: c.name, latitude: c.latitude, longitude: c.longitude };
  }
  if (filters.department) {
    const d = findDepartmentBySlug(filters.department) ?? findDepartmentByCode(filters.department);
    const centroid = d ? departmentCentroid(d.code) : null;
    if (d && centroid) return { label: d.name, ...centroid };
  }
  return null;
}

async function resolveCategory(slug: string, executor: DbExecutor) {
  if (!slug) return null;
  const [c] = await executor
    .select({ id: professionalCategories.id, slug: professionalCategories.slug, name: professionalCategories.name, description: professionalCategories.description, isChildcare: professionalCategories.isChildcare })
    .from(professionalCategories)
    .where(and(eq(professionalCategories.slug, slug), eq(professionalCategories.isActive, true)))
    .limit(1);
  return c ?? null;
}

/** Weekday 0 = Monday … 6 = Sunday, from an ISO date (local calendar, no TZ shift for a date-only value). */
export function weekdayFromIsoDate(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const js = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay(); // 0 = Sunday
  return (js + 6) % 7;
}

function buildWhere(filters: SearchFilters, categoryId: string | null, departmentCode: string | null, viewerUserId: string | null): SQL[] {
  const where: SQL[] = [isPublicListing(), isNull(professionals.deletedAt)];
  if (categoryId) {
    where.push(sql`(${professionals.primaryCategoryId} = ${categoryId} or exists (select 1 from professional_category_assignments a where a.professional_id = ${professionals.id} and a.category_id = ${categoryId}))`);
  }
  if (departmentCode && !filters.radius) where.push(eq(professionals.department, departmentCode));
  if (filters.city && !filters.radius) where.push(sql`${professionals.city} ilike ${filters.city}`);
  if (filters.eventType) where.push(sql`${professionals.eventTypes} ? ${filters.eventType}`);
  if (filters.children === "1") where.push(eq(professionals.acceptsChildrenServices, true));
  if (filters.verification > 0) where.push(sql`${professionals.verificationLevel} >= ${filters.verification}`);
  if (filters.priceMax > 0) where.push(sql`(${professionals.priceFromCents} is null or ${professionals.priceFromCents} <= ${filters.priceMax * 100})`);
  if (filters.priceMin > 0) where.push(sql`(${professionals.priceToCents} is null or ${professionals.priceToCents} >= ${filters.priceMin * 100})`);
  const langs = languagesFromFilter(filters.languages);
  if (langs.length) where.push(sql`${professionals.languages} ?| ${sql.raw(`array[${langs.map((l) => `'${l.replace(/'/g, "")}'`).join(",")}]`)}`);
  if (filters.q) {
    const q = filters.q;
    where.push(
      sql`(to_tsvector('french', coalesce(${professionals.displayName}, '') || ' ' || coalesce(${professionals.tagline}, '') || ' ' || coalesce(${professionals.description}, '')) @@ plainto_tsquery('french', ${q})
        or ${professionals.displayName} ilike ${"%" + q + "%"}
        or exists (select 1 from professional_services s where s.professional_id = ${professionals.id} and s.is_active and s.name ilike ${"%" + q + "%"})
        or exists (select 1 from professional_categories c where c.id = ${professionals.primaryCategoryId} and c.name ilike ${"%" + q + "%"}))`,
    );
  }
  if (filters.date) {
    const weekday = weekdayFromIsoDate(filters.date);
    // Excluded when an explicit unavailability covers the day, or when a weekly grid exists without that weekday.
    where.push(sql`not exists (select 1 from calendar_entries ce where ce.professional_id = ${professionals.id} and ce.kind = 'unavailability' and ce.starts_at < (${filters.date}::date + interval '1 day') and ce.ends_at > ${filters.date}::date)`);
    where.push(sql`(not exists (select 1 from professional_availability pa where pa.professional_id = ${professionals.id}) or exists (select 1 from professional_availability pa where pa.professional_id = ${professionals.id} and pa.weekday = ${weekday}))`);
  }
  if (filters.favorites === "1" && viewerUserId) {
    where.push(sql`exists (select 1 from professional_favorites f where f.professional_id = ${professionals.id} and f.user_id = ${viewerUserId})`);
  }
  return where;
}

async function hydrate(ids: string[], viewerUserId: string | null, executor: DbExecutor): Promise<{ services: Map<string, string[]>; covers: Map<string, string>; favorites: Set<string> }> {
  const services = new Map<string, string[]>();
  const covers = new Map<string, string>();
  const favorites = new Set<string>();
  if (!ids.length) return { services, covers, favorites };
  const svc = await executor
    .select({ professionalId: professionalServices.professionalId, name: professionalServices.name })
    .from(professionalServices)
    .where(and(inArray(professionalServices.professionalId, ids), eq(professionalServices.isActive, true)))
    .orderBy(asc(professionalServices.sortOrder));
  for (const s of svc) {
    const list = services.get(s.professionalId) ?? [];
    if (list.length < 3) list.push(s.name);
    services.set(s.professionalId, list);
  }
  const media = await executor
    .select({ professionalId: mediaAssets.professionalId, fileId: mediaAssets.fileId, kind: mediaAssets.kind, sortOrder: mediaAssets.sortOrder })
    .from(mediaAssets)
    .where(inArray(mediaAssets.professionalId, ids))
    .orderBy(asc(mediaAssets.sortOrder));
  for (const m of media) {
    if (!covers.has(m.professionalId) || m.kind === "cover") covers.set(m.professionalId, m.fileId);
  }
  if (viewerUserId) {
    const favs = await executor.select({ professionalId: professionalFavorites.professionalId }).from(professionalFavorites).where(and(eq(professionalFavorites.userId, viewerUserId), inArray(professionalFavorites.professionalId, ids)));
    for (const f of favs) favorites.add(f.professionalId);
  }
  return { services, covers, favorites };
}

export async function searchDirectory(filters: SearchFilters, viewerUserId: string | null = null, executor: DbExecutor = db): Promise<DirectoryResult> {
  const category = await resolveCategory(filters.category, executor);
  const department = filters.department ? (findDepartmentBySlug(filters.department) ?? findDepartmentByCode(filters.department)) : null;
  const origin = resolveOrigin(filters);
  const where = buildWhere(filters, category?.id ?? null, department?.code ?? null, viewerUserId);

  const rows = await executor
    .select({
      id: professionals.id,
      slug: professionals.slug,
      displayName: professionals.displayName,
      tagline: professionals.tagline,
      city: professionals.city,
      department: professionals.department,
      latitude: professionals.latitude,
      longitude: professionals.longitude,
      interventionRadiusKm: professionals.interventionRadiusKm,
      priceFromCents: professionals.priceFromCents,
      priceToCents: professionals.priceToCents,
      priceUnit: professionals.priceUnit,
      verificationLevel: professionals.verificationLevel,
      completenessScore: professionals.completenessScore,
      averageRating: professionals.averageRating,
      reviewCount: professionals.reviewCount,
      acceptsChildrenServices: professionals.acceptsChildrenServices,
      eventTypes: professionals.eventTypes,
      isDemo: professionals.isDemo,
      primaryCategoryId: professionals.primaryCategoryId,
      categoryName: professionalCategories.name,
      categorySlug: professionalCategories.slug,
    })
    .from(professionals)
    .innerJoin(professionalCategories, eq(professionalCategories.id, professionals.primaryCategoryId))
    .where(and(...where))
    .limit(CANDIDATE_LIMIT);

  const candidates: Candidate[] = rows.map((r) => ({
    ...r,
    textMatch: Boolean(filters.q),
    secondaryMatch: Boolean(category) && r.primaryCategoryId !== category?.id,
    availableOnDate: filters.date ? true : null,
  }));

  // Radius filter + distance (in memory: haversine on the small candidate pool).
  const withDistance = candidates
    .map((c) => {
      const distanceKm = origin && c.latitude !== null && c.longitude !== null ? haversineKm(origin.latitude, origin.longitude, c.latitude, c.longitude) : null;
      return { c, distanceKm };
    })
    .filter(({ c, distanceKm }) => {
      if (!filters.radius || !origin) return true;
      if (distanceKm === null) return false;
      // The professional travels: within the requested radius OR within their own intervention radius.
      return distanceKm <= filters.radius || distanceKm <= c.interventionRadiusKm;
    });

  const ranked = withDistance
    .map(({ c, distanceKm }) => {
      const breakdown = scoreListing({
        categoryMatch: category ? (c.secondaryMatch ? "secondary" : "primary") : c.textMatch ? "text" : "none",
        distanceKm,
        decayKm: filters.radius || 100,
        availableOnDate: c.availableOnDate,
        eventTypeRequested: Boolean(filters.eventType),
        eventTypeMatch: filters.eventType ? c.eventTypes.includes(filters.eventType) : false,
        childrenRequested: filters.children === "1",
        acceptsChildren: c.acceptsChildrenServices,
        completenessScore: c.completenessScore,
        verificationLevel: c.verificationLevel,
        averageRating: c.averageRating,
        reviewCount: c.reviewCount,
      });
      return { ...c, distanceKm, score: breakdown.total };
    })
    .sort(compareRanked);

  const total = ranked.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const slice = ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Sponsored: active placements matching category/department, only among the matching (free) results.
  const sponsoredIds = await pickSponsored(filters, category?.slug ?? null, department?.code ?? null, new Set(ranked.map((r) => r.id)), executor);
  const sponsoredRows = ranked.filter((r) => sponsoredIds.includes(r.id));

  const ids = [...new Set([...slice.map((s) => s.id), ...sponsoredRows.map((s) => s.id)])];
  const extra = await hydrate(ids, viewerUserId, executor);
  const toCard = (r: (typeof ranked)[number]): DirectoryCard => ({
    id: r.id,
    slug: r.slug,
    displayName: r.displayName,
    tagline: r.tagline,
    city: r.city,
    department: r.department,
    departmentName: r.department ? (findDepartmentByCode(r.department)?.name ?? null) : null,
    categoryName: r.categoryName,
    categorySlug: r.categorySlug,
    priceFromCents: r.priceFromCents,
    priceToCents: r.priceToCents,
    priceUnit: r.priceUnit,
    verificationLevel: r.verificationLevel,
    averageRating: r.averageRating,
    reviewCount: r.reviewCount,
    acceptsChildrenServices: r.acceptsChildrenServices,
    isDemo: r.isDemo,
    coverFileId: extra.covers.get(r.id) ?? null,
    topServices: extra.services.get(r.id) ?? [],
    distanceKm: r.distanceKm === null ? null : Math.round(r.distanceKm),
    isFavorite: extra.favorites.has(r.id),
    score: r.score,
  });

  return {
    items: slice.map(toCard),
    sponsored: sponsoredRows.map(toCard),
    total,
    page,
    pageCount,
    origin,
    category: category ? { slug: category.slug, name: category.name, description: category.description, isChildcare: category.isChildcare } : null,
    departmentName: department?.name ?? null,
  };
}

async function maxSponsored(executor: DbExecutor): Promise<number> {
  const [row] = await executor.select({ value: configurationSettings.value }).from(configurationSettings).where(eq(configurationSettings.key, "sponsored.max_per_query")).limit(1);
  const n = Number(row?.value);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 5) : 2;
}

async function pickSponsored(filters: SearchFilters, categorySlug: string | null, departmentCode: string | null, eligible: Set<string>, executor: DbExecutor): Promise<string[]> {
  if (filters.favorites === "1") return [];
  const limit = await maxSponsored(executor);
  if (limit === 0 || eligible.size === 0) return [];
  const now = new Date();
  const conds: SQL[] = [eq(featuredPlacements.isActive, true), sql`${featuredPlacements.startsAt} <= ${now}`, sql`${featuredPlacements.endsAt} > ${now}`];
  conds.push(categorySlug ? sql`(${featuredPlacements.categorySlug} is null or ${featuredPlacements.categorySlug} = ${categorySlug})` : sql`${featuredPlacements.categorySlug} is null`);
  conds.push(departmentCode ? sql`(${featuredPlacements.department} is null or ${featuredPlacements.department} = ${departmentCode})` : sql`${featuredPlacements.department} is null`);
  const rows = await executor
    .select({ professionalId: featuredPlacements.professionalId })
    .from(featuredPlacements)
    .where(and(...conds))
    .orderBy(asc(featuredPlacements.startsAt))
    .limit(20);
  const out: string[] = [];
  for (const r of rows) {
    if (eligible.has(r.professionalId) && !out.includes(r.professionalId)) out.push(r.professionalId);
    if (out.length >= limit) break;
  }
  return out;
}

/** Suggestions for the empty state: categories with published listings and nearby departments. */
export async function emptyStateSuggestions(executor: DbExecutor = db): Promise<{ categories: Array<{ slug: string; name: string; count: number }> }> {
  const rows = await executor
    .select({ slug: professionalCategories.slug, name: professionalCategories.name, count: sql<number>`count(${professionals.id})::int` })
    .from(professionalCategories)
    .innerJoin(professionals, and(eq(professionals.primaryCategoryId, professionalCategories.id), isPublicListing(), isNull(professionals.deletedAt)))
    .groupBy(professionalCategories.slug, professionalCategories.name, professionalCategories.sortOrder)
    .orderBy(asc(professionalCategories.sortOrder))
    .limit(8);
  return { categories: rows };
}

/** City slug helper for geo pages. */
export function citySlug(city: string): string {
  return slugifyGeo(city);
}
