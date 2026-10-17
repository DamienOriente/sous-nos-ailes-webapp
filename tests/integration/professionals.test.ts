/**
 * Professionals module — service-level integration against the local database.
 * Covers: onboarding draft → steps → submission (moderation case + audit),
 * moderator publication, directory visibility, tenant isolation (another user
 * → NotFound), inquiries lifecycle, favourites, archiving.
 */
import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "./setup";
import { db } from "@/db/client";
import { auditLogs, emailOutbox, inquiries, moderationCases, notifications, organizationMembers, organizations, professionalCategories, professionalFavorites, professionals, users } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { searchDirectory } from "@/modules/directory/application/directory-search";
import { listIndexableDirectoryPaths } from "@/modules/directory/application/directory-paths";
import { toggleFavorite } from "@/modules/directory/application/favorites-service";
import { parseSearchParams } from "@/modules/directory/domain/search-params";
import { createPublicInquiry, getInquiryForProfessional, listInquiriesForProfessional, listInquiriesForRequester, replyToInquiry, sendQuote, transitionInquiry } from "@/modules/inquiries/application/inquiry-service";
import { listAvailability, replaceAvailability } from "@/modules/professionals/application/availability-service";
import {
  archiveListing,
  createDraft,
  getManagedListing,
  listManagedListings,
  saveStep2,
  saveStep3,
  saveStep4,
  setListingStatusAsModerator,
  submitForReview,
  updateListing,
} from "@/modules/professionals/application/professional-service";
import { createService, listServices } from "@/modules/professionals/application/services-service";
import { listToolsForListing, setToolEnabled } from "@/modules/tools/application/tool-service";
import { PaymentRequiredError } from "@/lib/errors";

const RUN = "itest-pro";
const OWNER: Actor = { userId: `${RUN}-owner`, email: `${RUN}-owner@sousnosailes.test`, name: "Itest Owner", globalRole: "user", emailVerified: true, isDemo: false };
const OTHER: Actor = { userId: `${RUN}-other`, email: `${RUN}-other@sousnosailes.test`, name: "Itest Other", globalRole: "user", emailVerified: true, isDemo: false };
const MOD: Actor = { userId: `${RUN}-mod`, email: `${RUN}-mod@sousnosailes.test`, name: "Itest Mod", globalRole: "moderator", emailVerified: true, isDemo: false };
const USER_IDS = [OWNER.userId, OTHER.userId, MOD.userId];

let categoryId: string;
let listingId: string;

async function cleanup() {
  const pros = await db.select({ id: professionals.id }).from(professionals).where(inArray(professionals.ownerUserId, USER_IDS));
  const ids = pros.map((p) => p.id);
  if (ids.length) {
    await db.delete(inquiries).where(inArray(inquiries.professionalId, ids));
    await db.delete(moderationCases).where(inArray(moderationCases.professionalId, ids));
    await db.delete(professionalFavorites).where(inArray(professionalFavorites.professionalId, ids));
    await db.delete(professionals).where(inArray(professionals.id, ids));
  }
  await db.delete(organizationMembers).where(inArray(organizationMembers.userId, USER_IDS));
  await db.delete(organizations).where(inArray(organizations.ownerUserId, USER_IDS));
  await db.delete(notifications).where(inArray(notifications.userId, USER_IDS));
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, USER_IDS));
  await db.delete(emailOutbox).where(like(emailOutbox.toEmail, `${RUN}%`));
  await db.delete(users).where(inArray(users.id, USER_IDS));
}

beforeAll(async () => {
  await cleanup();
  for (const a of [OWNER, OTHER, MOD]) {
    await db.insert(users).values({ id: a.userId, name: a.name, email: a.email, emailVerified: true, role: a.globalRole });
  }
  const [cat] = await db.select({ id: professionalCategories.id }).from(professionalCategories).where(eq(professionalCategories.slug, "garde-enfants-evenementielle")).limit(1);
  if (!cat) throw new Error("reference data missing: run pnpm db:seed first");
  categoryId = cat.id;
});
afterAll(cleanup);

describe("onboarding and status transitions", () => {
  it("creates a draft at step 1 and keeps it private to the owner", async () => {
    const { id } = await createDraft(OWNER, { primaryCategoryId: categoryId, secondaryCategoryIds: [] });
    listingId = id;
    const managed = await getManagedListing(OWNER, id);
    expect(managed.listing.status).toBe("draft");
    expect(managed.listing.acceptsChildrenServices).toBe(true); // childcare category
    await expect(getManagedListing(OTHER, id)).rejects.toBeInstanceOf(NotFoundError);
    const mine = await listManagedListings(OWNER);
    expect(mine.map((l) => l.id)).toContain(id);
    expect((await listManagedListings(OTHER)).map((l) => l.id)).not.toContain(id);
  });

  it("refuses submission before the completeness threshold", async () => {
    await expect(submitForReview(OWNER, listingId)).rejects.toBeInstanceOf(ValidationError);
  });

  it("step 2 derives department/region/coordinates, builds the slug and creates the organisation", async () => {
    await saveStep2(OWNER, listingId, { displayName: "Itest Garde Enfants", organizationType: "company", siret: "73282932000074", city: "Toulouse", postalCode: "31000", interventionRadiusKm: 60 });
    const { listing } = await getManagedListing(OWNER, listingId);
    expect(listing.slug).toBe("itest-garde-enfants");
    expect(listing.department).toBe("31");
    expect(listing.region).toBe("Occitanie");
    expect(listing.latitude).toBeCloseTo(43.6047, 2);
    expect(listing.organizationId).not.toBeNull();
    const [org] = await db.select().from(organizations).where(eq(organizations.id, listing.organizationId!));
    expect(org?.siren).toBe("732829320");
    expect(org?.siret).toBe("73282932000074");
  });

  it("step 2 rejects a malformed SIRET through the schema (service trusts validated input)", async () => {
    await expect(saveStep2(OWNER, listingId, { displayName: "Itest", organizationType: "sole_trader", siret: "", city: "Nulle-Part", postalCode: "00000", interventionRadiusKm: 10 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("step 3 validates trade details against the category form", async () => {
    await expect(saveStep3(OWNER, listingId, { experienceYears: 3 })).rejects.toBeInstanceOf(ValidationError);
    await saveStep3(OWNER, listingId, { experienceYears: 3, ageRanges: ["3-6"], services: ["supervision", "activities"], legalStatus: "company", maxChildrenPerStaff: 6, insuranceDeclared: true });
    const { listing } = await getManagedListing(OWNER, listingId);
    expect(listing.tradeDetails.maxChildrenPerStaff).toBe(6);
  });

  it("step 4 stores presentation and recomputes completeness", async () => {
    await saveStep4(OWNER, listingId, { tagline: "Garde douce et joyeuse pour vos réceptions", description: "d".repeat(260), priceFromCents: 3000, priceToCents: 5000, priceUnit: "hour", languages: ["fr", "en"], eventTypes: ["wedding"], yearsExperience: 3, publicEmail: "pro@itest.test", acceptsChildrenServices: true });
    const { listing } = await getManagedListing(OWNER, listingId);
    expect(listing.completenessScore).toBeGreaterThanOrEqual(60);
  });

  it("services and availability are managed by the owner only", async () => {
    await createService(OWNER, listingId, { name: "Garde cocktail", description: "", priceCents: 25000, priceUnit: "event", isActive: true });
    await expect(createService(OTHER, listingId, { name: "Hack", description: "", isActive: true })).rejects.toBeInstanceOf(NotFoundError);
    expect((await listServices(OWNER, listingId)).length).toBe(1);
    await replaceAvailability(OWNER, listingId, [{ weekday: 5, startMinute: 480, endMinute: 1440 }]);
    expect((await listAvailability(OWNER, listingId)).length).toBe(1);
    await expect(replaceAvailability(OTHER, listingId, [])).rejects.toBeInstanceOf(NotFoundError);
  });

  it("submission opens a moderation case, writes an audit row and sets identity_declared", async () => {
    await submitForReview(OWNER, listingId);
    const { listing } = await getManagedListing(OWNER, listingId);
    expect(listing.status).toBe("pending_review");
    expect(listing.verificationLevel).toBe(1);
    const cases = await db.select().from(moderationCases).where(and(eq(moderationCases.professionalId, listingId), eq(moderationCases.kind, "profile_review")));
    expect(cases.length).toBe(1);
    const audits = await db.select().from(auditLogs).where(and(eq(auditLogs.resourceId, listingId), eq(auditLogs.action, "professional.submitted")));
    expect(audits.length).toBe(1);
    await expect(submitForReview(OWNER, listingId)).rejects.toBeInstanceOf(ConflictError);
  });

  it("is invisible in the directory until a moderator publishes it", async () => {
    const before = await searchDirectory(parseSearchParams({ q: "Itest Garde" }));
    expect(before.items.map((i) => i.id)).not.toContain(listingId);
    await expect(setListingStatusAsModerator(OWNER, listingId, "published")).rejects.toThrow();
    await expect(setListingStatusAsModerator(MOD, listingId, "archived")).rejects.toBeInstanceOf(ConflictError);
    await setListingStatusAsModerator(MOD, listingId, "published", "Fiche complète.");
    const after = await searchDirectory(parseSearchParams({ q: "Itest Garde", category: "garde-enfants-evenementielle", department: "haute-garonne" }));
    expect(after.items.map((i) => i.id)).toContain(listingId);
    const card = after.items.find((i) => i.id === listingId)!;
    expect(card.topServices).toEqual(["Garde cocktail"]);
    expect(card.verificationLevel).toBe(1);
    const notif = await db.select().from(notifications).where(and(eq(notifications.userId, OWNER.userId), eq(notifications.type, "profile_approved")));
    expect(notif.length).toBe(1);
  });

  it("availability filter excludes the listing on a weekday without slots and keeps it on Saturday", async () => {
    const monday = await searchDirectory(parseSearchParams({ q: "Itest Garde", date: "2026-10-19" }));
    expect(monday.items.map((i) => i.id)).not.toContain(listingId);
    const saturday = await searchDirectory(parseSearchParams({ q: "Itest Garde", date: "2026-10-24" }));
    expect(saturday.items.map((i) => i.id)).toContain(listingId);
  });

  it("non-demo published listings produce indexable directory paths", async () => {
    const paths = await listIndexableDirectoryPaths();
    expect(paths.map((p) => p.path)).toContain("/annuaire/garde-enfants-evenementielle/haute-garonne");
    expect(paths.map((p) => p.path)).toContain("/annuaire/garde-enfants-evenementielle/toulouse");
  });

  it("a major change on a published listing opens a profile_update_review case but keeps it online", async () => {
    const { reviewOpened } = await updateListing(
      OWNER,
      listingId,
      { displayName: "Itest Garde Enfants Plus", organizationType: "company", siret: "73282932000074", city: "Toulouse", postalCode: "31000", interventionRadiusKm: 60, primaryCategoryId: categoryId, secondaryCategoryIds: [], tagline: "Garde douce et joyeuse pour vos réceptions", description: "d".repeat(260), priceFromCents: 3000, priceToCents: 5000, priceUnit: "hour", languages: ["fr"], eventTypes: ["wedding"], yearsExperience: 3, publicEmail: "pro@itest.test", acceptsChildrenServices: true },
      null,
    );
    expect(reviewOpened).toBe(true);
    const { listing } = await getManagedListing(OWNER, listingId);
    expect(listing.status).toBe("published");
    expect(listing.slug).toBe("itest-garde-enfants"); // slug is stable once set
    const cases = await db.select().from(moderationCases).where(and(eq(moderationCases.professionalId, listingId), eq(moderationCases.kind, "profile_update_review")));
    expect(cases.length).toBe(1);
  });

  it("isolation: another user cannot edit, and gets the same NotFound as a missing id", async () => {
    const input = { displayName: "Pwned", organizationType: "sole_trader" as const, siret: "", city: "Toulouse", postalCode: "31000", interventionRadiusKm: 10, primaryCategoryId: categoryId, secondaryCategoryIds: [], tagline: "", description: "", languages: ["fr"], eventTypes: [], acceptsChildrenServices: false };
    await expect(updateListing(OTHER, listingId, input, null)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateListing(OTHER, "00000000-0000-4000-8000-000000000000", input, null)).rejects.toBeInstanceOf(NotFoundError);
    const { listing } = await getManagedListing(OWNER, listingId);
    expect(listing.displayName).toBe("Itest Garde Enfants Plus");
  });
});

describe("inquiries", () => {
  let inquiryId: string;

  it("public inquiry → notification + e-mails, visible to the professional only", async () => {
    const { id } = await createPublicInquiry(
      { professionalId: listingId, kind: "quote", requesterName: "Itest Requester", requesterEmail: `${RUN}-requester@sousnosailes.test`, requesterPhone: "", eventTypeLabel: "Mariage", eventDate: "2027-06-12", eventCity: "Lavaur", guestsCount: 100, childrenCount: 12, message: "Nous cherchons une garde pour douze enfants pendant la soirée.", consent: true, website: "", eventId: null },
      OTHER,
    );
    inquiryId = id;
    const mine = await listInquiriesForProfessional(OWNER, listingId);
    expect(mine.map((i) => i.id)).toContain(id);
    await expect(listInquiriesForProfessional(OTHER, listingId)).rejects.toBeInstanceOf(NotFoundError);
    const forRequester = await listInquiriesForRequester(OTHER.userId);
    expect(forRequester.map((r) => r.inquiry.id)).toContain(id);
    const notif = await db.select().from(notifications).where(and(eq(notifications.userId, OWNER.userId), eq(notifications.type, "inquiry_received")));
    expect(notif.length).toBe(1);
    const mails = await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, `${RUN}-requester@sousnosailes.test`));
    expect(mails.some((m) => m.templateKey === "inquiry")).toBe(true);
  });

  it("refuses inquiries to unpublished listings", async () => {
    const { id: draft } = await createDraft(OWNER, { primaryCategoryId: categoryId, secondaryCategoryIds: [] });
    await expect(createPublicInquiry({ professionalId: draft, kind: "contact", requesterName: "X Y", requesterEmail: "x@y.test", message: "Bonjour, un message assez long.", consent: true, website: "", eventId: null }, null)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("opening marks viewed; reply, quote and transitions follow the state machine", async () => {
    const opened = await getInquiryForProfessional(OWNER, listingId, inquiryId);
    expect(opened.inquiry.status).toBe("viewed");
    await replyToInquiry(OWNER, listingId, inquiryId, "Merci, pouvez-vous préciser les âges ?", "info_requested");
    await sendQuote(OWNER, listingId, inquiryId, { quoteCents: 95000, quoteNote: "Soirée complète" });
    await expect(transitionInquiry(OWNER, listingId, inquiryId, "confirmed")).rejects.toBeInstanceOf(ConflictError);
    await transitionInquiry(OWNER, listingId, inquiryId, "accepted");
    await transitionInquiry(OWNER, listingId, inquiryId, "confirmed");
    const { inquiry, history } = await getInquiryForProfessional(OWNER, listingId, inquiryId);
    expect(inquiry.status).toBe("confirmed");
    expect(inquiry.quoteCents).toBe(95000);
    expect(history.length).toBeGreaterThanOrEqual(5);
    await expect(transitionInquiry(OTHER, listingId, inquiryId, "archived")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("tools, favourites and archiving", () => {
  it("lists trade-relevant tools, locks premium ones", async () => {
    const tools = await listToolsForListing(OWNER, listingId);
    const keys = tools.map((t) => t.key);
    expect(keys).toContain("childcare_roster");
    expect(keys).not.toContain("music_brief");
    const stats = tools.find((t) => t.key === "stats");
    expect(stats?.entitled).toBe(false);
    await expect(setToolEnabled(OWNER, listingId, "stats", true)).rejects.toBeInstanceOf(PaymentRequiredError);
    await setToolEnabled(OWNER, listingId, "childcare_roster", true);
    expect((await listToolsForListing(OWNER, listingId)).find((t) => t.key === "childcare_roster")?.enabled).toBe(true);
    await expect(listToolsForListing(OTHER, listingId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("favourites toggle and filter", async () => {
    expect((await toggleFavorite(OTHER, listingId)).isFavorite).toBe(true);
    const favs = await searchDirectory(parseSearchParams({ favorites: "1" }), OTHER.userId);
    expect(favs.items.map((i) => i.id)).toContain(listingId);
    expect(favs.items.find((i) => i.id === listingId)?.isFavorite).toBe(true);
    expect((await toggleFavorite(OTHER, listingId)).isFavorite).toBe(false);
  });

  it("archiving soft-deletes, removes from the directory and from management", async () => {
    await expect(archiveListing(OTHER, listingId)).rejects.toBeInstanceOf(NotFoundError);
    await archiveListing(OWNER, listingId, "Fin d'activité");
    await expect(getManagedListing(OWNER, listingId)).rejects.toBeInstanceOf(NotFoundError);
    const res = await searchDirectory(parseSearchParams({ q: "Itest Garde" }));
    expect(res.items.map((i) => i.id)).not.toContain(listingId);
    const [row] = await db.select({ status: professionals.status, deletedAt: professionals.deletedAt }).from(professionals).where(eq(professionals.id, listingId));
    expect(row?.status).toBe("archived");
    expect(row?.deletedAt).not.toBeNull();
    const audits = await db.select().from(auditLogs).where(and(eq(auditLogs.resourceId, listingId), eq(auditLogs.action, "professional.archived")));
    expect(audits.length).toBe(1);
  });
});
