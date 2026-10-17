import { eq, inArray } from "drizzle-orm";
import {
  contactEventLinks,
  contacts,
  eventGuests,
  guestGroups,
  invitationCheckins,
  invitationResponses,
  invitationTokens,
  invitations,
  seatingAssignments,
  seatingTables,
} from "@/db/schema";
import { encryptText, hashToken, randomToken } from "@/lib/crypto";
import { computeDedupeKey } from "@/modules/contacts/domain/normalize";
import type { SeedContext } from "./context";

/**
 * Demo data for contacts, guests, invitations, check-ins and seating.
 * Idempotent: rows belonging to the demo events / demo owners are wiped and
 * recreated. Tokens are random on every run (hash + encrypted copy), so no
 * clear token ever lives in the repository.
 */
type GuestSeed = { first: string; last: string; group: string; child?: number; rsvp?: "accepted" | "declined" | "maybe"; plus?: number; diet?: string; email?: boolean };

const LOUIS_LISA_GUESTS: GuestSeed[] = [
  // Famille Marchand (côté marié)
  { first: "Bernard", last: "Marchand", group: "Famille Marchand", rsvp: "accepted", plus: 1, email: true },
  { first: "Monique", last: "Marchand", group: "Famille Marchand", rsvp: "accepted" },
  { first: "Julie", last: "Marchand", group: "Famille Marchand", rsvp: "accepted", plus: 1, email: true },
  { first: "Thomas", last: "Marchand", group: "Famille Marchand", rsvp: "accepted" },
  { first: "Léa", last: "Marchand", group: "Famille Marchand", child: 6, rsvp: "accepted" },
  { first: "Noah", last: "Marchand", group: "Famille Marchand", child: 3, rsvp: "accepted" },
  { first: "Pierre", last: "Marchand", group: "Famille Marchand", rsvp: "declined", email: true },
  { first: "Claire", last: "Dubois", group: "Famille Marchand", rsvp: "accepted", diet: "Végétarien", email: true },
  { first: "Marc", last: "Dubois", group: "Famille Marchand", rsvp: "accepted" },
  { first: "Emma", last: "Dubois", group: "Famille Marchand", child: 9, rsvp: "accepted" },
  { first: "Jacques", last: "Marchand", group: "Famille Marchand", rsvp: "maybe", email: true },
  { first: "Françoise", last: "Marchand", group: "Famille Marchand", rsvp: "maybe" },
  { first: "Antoine", last: "Perrin", group: "Famille Marchand", email: true },
  { first: "Sophie", last: "Perrin", group: "Famille Marchand", diet: "Sans gluten" },
  { first: "Louise", last: "Perrin", group: "Famille Marchand", child: 11 },
  // Famille de Lisa (côté mariée)
  { first: "Alain", last: "Bertrand", group: "Famille de Lisa", rsvp: "accepted", plus: 1, email: true },
  { first: "Nathalie", last: "Bertrand", group: "Famille de Lisa", rsvp: "accepted" },
  { first: "Camille", last: "Bertrand", group: "Famille de Lisa", rsvp: "accepted", email: true },
  { first: "Hugo", last: "Bertrand", group: "Famille de Lisa", rsvp: "accepted", diet: "Sans porc" },
  { first: "Zoé", last: "Bertrand", group: "Famille de Lisa", child: 5, rsvp: "accepted" },
  { first: "Gabriel", last: "Bertrand", group: "Famille de Lisa", child: 2, rsvp: "accepted" },
  { first: "Michel", last: "Roux", group: "Famille de Lisa", rsvp: "declined", email: true },
  { first: "Annie", last: "Roux", group: "Famille de Lisa", rsvp: "declined" },
  { first: "Sarah", last: "Lemoine", group: "Famille de Lisa", rsvp: "accepted", email: true },
  { first: "Karim", last: "Lemoine", group: "Famille de Lisa", rsvp: "accepted", diet: "Halal" },
  { first: "Inès", last: "Lemoine", group: "Famille de Lisa", child: 7, rsvp: "accepted" },
  { first: "Yanis", last: "Lemoine", group: "Famille de Lisa", child: 4, rsvp: "accepted" },
  { first: "Christine", last: "Bertrand", group: "Famille de Lisa", email: true },
  { first: "Gérard", last: "Bertrand", group: "Famille de Lisa" },
  { first: "Océane", last: "Fabre", group: "Famille de Lisa", rsvp: "maybe", email: true },
  // Amis
  { first: "Maxime", last: "Girard", group: "Amis", rsvp: "accepted", plus: 1, email: true },
  { first: "Chloé", last: "Girard", group: "Amis", rsvp: "accepted" },
  { first: "Romain", last: "Blanc", group: "Amis", rsvp: "accepted", email: true },
  { first: "Manon", last: "Blanc", group: "Amis", rsvp: "accepted", diet: "Végétalien" },
  { first: "Tom", last: "Blanc", group: "Amis", child: 1, rsvp: "accepted" },
  { first: "Julien", last: "Moreau", group: "Amis", rsvp: "declined", email: true },
  { first: "Aurélie", last: "Fontaine", group: "Amis", rsvp: "accepted", email: true },
  { first: "Nicolas", last: "Fontaine", group: "Amis", rsvp: "accepted" },
  { first: "Lucas", last: "Fontaine", group: "Amis", child: 8, rsvp: "accepted" },
  { first: "Mehdi", last: "Benali", group: "Amis", rsvp: "maybe", email: true },
  { first: "Laura", last: "Costa", group: "Amis", email: true },
  { first: "Diego", last: "Costa", group: "Amis" },
  { first: "Élodie", last: "Renard", group: "Amis", rsvp: "accepted", plus: 1, email: true },
  { first: "Baptiste", last: "Caron", group: "Amis", email: true },
  { first: "Margaux", last: "Leroy", group: "Amis", rsvp: "accepted", email: true },
  // Collègues
  { first: "Stéphane", last: "Garnier", group: "Collègues", rsvp: "accepted", email: true },
  { first: "Valérie", last: "Garnier", group: "Collègues", rsvp: "accepted" },
  { first: "Olivier", last: "Masson", group: "Collègues", rsvp: "declined", email: true },
  { first: "Céline", last: "Petit", group: "Collègues", rsvp: "accepted", plus: 1, email: true, diet: "Pescétarien" },
  { first: "David", last: "Henry", group: "Collègues", rsvp: "maybe", email: true },
  { first: "Amandine", last: "Lambert", group: "Collègues", email: true },
  { first: "Quentin", last: "Rousseau", group: "Collègues", rsvp: "accepted", email: true },
  { first: "Fatou", last: "Diallo", group: "Collègues", rsvp: "accepted", email: true },
  { first: "Matthieu", last: "Vincent", group: "Collègues", email: true },
  { first: "Isabelle", last: "Chevalier", group: "Collègues", rsvp: "accepted", email: true },
  { first: "Paul", last: "Chevalier", group: "Collègues", child: 10, rsvp: "accepted" },
  { first: "Sandrine", last: "Noël", group: "Collègues", rsvp: "declined", email: true },
  { first: "Franck", last: "Barbier", group: "Collègues", email: true },
  { first: "Nadia", last: "Guérin", group: "Collègues", rsvp: "accepted", email: true },
  { first: "Vincent", last: "Lefebvre", group: "Collègues", rsvp: "maybe", email: true },
];

const CHLOE_GUESTS: GuestSeed[] = [
  { first: "Paul", last: "Nguyen", group: "Famille", rsvp: "accepted" },
  { first: "Mai", last: "Nguyen", group: "Famille", rsvp: "accepted" },
  { first: "Chloé", last: "Nguyen", group: "Famille", child: 0, rsvp: "accepted" },
  { first: "Lan", last: "Nguyen", group: "Famille", rsvp: "accepted", email: true },
  { first: "Minh", last: "Nguyen", group: "Famille", rsvp: "accepted" },
  { first: "Hélène", last: "Martin", group: "Famille", rsvp: "accepted", email: true },
  { first: "Robert", last: "Martin", group: "Famille", rsvp: "maybe" },
  { first: "Léna", last: "Martin", group: "Famille", child: 4, rsvp: "accepted" },
  { first: "Arthur", last: "Martin", group: "Famille", child: 6, rsvp: "accepted" },
  { first: "Sonia", last: "Tran", group: "Parrain & marraine", rsvp: "accepted", email: true },
  { first: "Kevin", last: "Tran", group: "Parrain & marraine", rsvp: "accepted" },
  { first: "Jade", last: "Tran", group: "Parrain & marraine", child: 3, rsvp: "accepted" },
  { first: "Caroline", last: "Simon", group: "Amis", rsvp: "declined", email: true },
  { first: "Benoît", last: "Simon", group: "Amis", email: true },
  { first: "Léo", last: "Simon", group: "Amis", child: 5 },
];

const LOUIS_CONTACTS: Array<{ first: string; last: string; company?: string; email?: string; phone?: string; category: string; tags: string[]; notes?: string }> = [
  { first: "Bernard", last: "Marchand", email: "bernard.marchand@example.test", phone: "06 11 22 33 44", category: "family", tags: ["famille", "témoin"] },
  { first: "Monique", last: "Marchand", email: "monique.marchand@example.test", category: "family", tags: ["famille"] },
  { first: "Julie", last: "Marchand", email: "julie.marchand@example.test", phone: "06 55 44 33 22", category: "family", tags: ["famille"] },
  { first: "Claire", last: "Dubois", email: "claire.dubois@example.test", category: "family", tags: ["famille", "végétarien"] },
  { first: "Alain", last: "Bertrand", email: "alain.bertrand@example.test", phone: "06 99 88 77 66", category: "family", tags: ["famille-lisa"] },
  { first: "Sarah", last: "Lemoine", email: "sarah.lemoine@example.test", category: "family", tags: ["famille-lisa"] },
  { first: "Maxime", last: "Girard", email: "maxime.girard@example.test", phone: "07 12 34 56 78", category: "friend", tags: ["amis", "témoin"], notes: "Témoin de Louis — discours prévu." },
  { first: "Romain", last: "Blanc", email: "romain.blanc@example.test", category: "friend", tags: ["amis"] },
  { first: "Aurélie", last: "Fontaine", email: "aurelie.fontaine@example.test", category: "friend", tags: ["amis"] },
  { first: "Élodie", last: "Renard", email: "elodie.renard@example.test", category: "friend", tags: ["amis", "musique"] },
  { first: "Stéphane", last: "Garnier", email: "stephane.garnier@example.test", category: "colleague", tags: ["collègues"] },
  { first: "Céline", last: "Petit", email: "celine.petit@example.test", category: "colleague", tags: ["collègues"] },
  { first: "Fatou", last: "Diallo", email: "fatou.diallo@example.test", category: "colleague", tags: ["collègues"] },
  { first: "Nadia", last: "Guérin", email: "nadia.guerin@example.test", category: "colleague", tags: ["collègues"] },
  { first: "Fleurs & Cie", last: "", company: "Fleurs & Cie", email: "contact@fleurs-cie.test", phone: "05 61 00 00 01", category: "provider", tags: ["fleuriste", "devis"] },
  { first: "Lucie", last: "Barreau", company: "Maison Barreau Pâtisserie", email: "lucie@barreau-patisserie.test", phone: "05 61 00 00 02", category: "provider", tags: ["pâtissier"] },
  { first: "Mairie", last: "de Lavaur", company: "Mairie de Lavaur", phone: "05 63 00 00 03", category: "other", tags: ["cérémonie"] },
  { first: "Père", last: "Olivier", company: "Paroisse Saint-Alain", email: "paroisse.lavaur@example.test", category: "other", tags: ["cérémonie"] },
  { first: "Marc", last: "Dubois", email: "marc.dubois@example.test", category: "family", tags: ["famille"] },
  // Deliberate duplicate of Maxime Girard: same e-mail with different case and spacing (detectable via dedupe key).
  { first: "Max", last: "Girard", email: "Maxime.Girard@Example.test ", category: "friend", tags: ["ancien-fichier"] },
];

const CAMILLE_CONTACTS: Array<{ first: string; last: string; company: string; email: string; phone?: string; tags: string[] }> = [
  { first: "Julien", last: "Rossi", company: "Rossi Traiteur", email: "julien.traiteur@sousnosailes.test", phone: "05 63 11 22 33", tags: ["traiteur", "albi"] },
  { first: "Hélène", last: "Vasseur", company: "Domaine des Tilleuls", email: "helene.domaine@sousnosailes.test", tags: ["lieu", "lavaur"] },
  { first: "Théo", last: "Lambert", company: "DJ Théo", email: "theo.dj@sousnosailes.test", tags: ["dj"] },
  { first: "Inès", last: "Garnier", company: "Inès Garnier Photographie", email: "ines.photo@sousnosailes.test", tags: ["photographe"] },
  { first: "Marie", last: "Delcourt", company: "Les Petits Ailés", email: "marie.garde@sousnosailes.test", tags: ["garde-enfants"] },
  { first: "Atelier", last: "Floral", company: "Atelier Floral Toulouse", email: "contact@atelier-floral.test", phone: "05 61 22 33 44", tags: ["fleuriste"] },
  { first: "Loc", last: "Déco", company: "LocDéco Occitanie", email: "hello@locdeco.test", tags: ["location", "décoration"] },
  { first: "Studio", last: "Papier", company: "Studio Papier", email: "bonjour@studio-papier.test", tags: ["papeterie", "faire-part"] },
];

function slugEmail(first: string, last: string): string {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  return `${norm(first)}.${norm(last)}@example.test`;
}

async function wipeEvent(ctx: SeedContext, eventId: string): Promise<void> {
  const { db } = ctx;
  // Cascades remove assignments, tokens, responses and check-ins.
  await db.delete(invitationCheckins).where(eq(invitationCheckins.eventId, eventId));
  await db.delete(invitations).where(eq(invitations.eventId, eventId));
  await db.delete(seatingTables).where(eq(seatingTables.eventId, eventId));
  await db.delete(eventGuests).where(eq(eventGuests.eventId, eventId));
  await db.delete(guestGroups).where(eq(guestGroups.eventId, eventId));
}

async function newToken(ctx: SeedContext, invitationId: string, purpose: "rsvp" | "checkin", expiresAt: Date, maxUses: number, useCount = 0, usedAt: Date | null = null): Promise<string> {
  const token = randomToken(32);
  const [row] = await ctx.db
    .insert(invitationTokens)
    .values({ invitationId, purpose, tokenHash: hashToken(token), tokenEncrypted: encryptText(token), expiresAt, maxUses, useCount, usedAt })
    .returning({ id: invitationTokens.id });
  return row!.id;
}

async function seedEventGuests(ctx: SeedContext, eventId: string, seeds: GuestSeed[], sides: Record<string, string | null>): Promise<Array<{ id: string; seed: GuestSeed; groupId: string }>> {
  const { db, now } = ctx;
  const groupIds = new Map<string, string>();
  for (const name of Array.from(new Set(seeds.map((s) => s.group)))) {
    const [g] = await db.insert(guestGroups).values({ eventId, name, side: sides[name] ?? null }).returning({ id: guestGroups.id });
    groupIds.set(name, g!.id);
  }
  const out: Array<{ id: string; seed: GuestSeed; groupId: string }> = [];
  for (const s of seeds) {
    const groupId = groupIds.get(s.group)!;
    const answered = s.rsvp !== undefined;
    const [g] = await db
      .insert(eventGuests)
      .values({
        eventId,
        groupId,
        firstName: s.first,
        lastName: s.last,
        email: s.email ? slugEmail(s.first, s.last) : null,
        isChild: s.child !== undefined,
        ageYears: s.child ?? null,
        dietaryPreference: s.diet ?? null,
        plusOnesAllowed: s.plus ?? 0,
        rsvpStatus: s.rsvp ?? "pending",
        rsvpAnsweredAt: answered ? new Date(now.getTime() - 5 * 86_400_000) : null,
        rsvpGuestsCount: s.rsvp === "accepted" ? 1 + (s.plus ?? 0) : null,
      })
      .returning({ id: eventGuests.id });
    out.push({ id: g!.id, seed: s, groupId });
  }
  return out;
}

async function seedLouisLisa(ctx: SeedContext, eventId: string): Promise<void> {
  const { db, now } = ctx;
  await wipeEvent(ctx, eventId);
  const guests = await seedEventGuests(ctx, eventId, LOUIS_LISA_GUESTS, { "Famille Marchand": "marié", "Famille de Lisa": "mariée", Amis: "commun", Collègues: "commun" });
  const byName = (first: string, last: string) => guests.find((g) => g.seed.first === first && g.seed.last === last)!;
  const expiresAt = new Date("2027-06-19T23:59:59Z");
  const sent = new Date(now.getTime() - 20 * 86_400_000);
  const creator = ctx.users.louis ?? null;

  // 25 invitations: families first (one link per household), then individuals.
  const families: Array<{ name: string; members: Array<[string, string]>; template: string }> = [
    { name: "Famille Bernard et Monique Marchand", members: [["Bernard", "Marchand"], ["Monique", "Marchand"]], template: "classic" },
    { name: "Famille Julie et Thomas Marchand", members: [["Julie", "Marchand"], ["Thomas", "Marchand"], ["Léa", "Marchand"], ["Noah", "Marchand"]], template: "rustic" },
    { name: "Famille Dubois", members: [["Claire", "Dubois"], ["Marc", "Dubois"], ["Emma", "Dubois"]], template: "rustic" },
    { name: "Famille Perrin", members: [["Antoine", "Perrin"], ["Sophie", "Perrin"], ["Louise", "Perrin"]], template: "classic" },
    { name: "Famille Alain et Nathalie Bertrand", members: [["Alain", "Bertrand"], ["Nathalie", "Bertrand"]], template: "modern" },
    { name: "Famille Lemoine", members: [["Sarah", "Lemoine"], ["Karim", "Lemoine"], ["Inès", "Lemoine"], ["Yanis", "Lemoine"]], template: "kids" },
    { name: "Famille Roux", members: [["Michel", "Roux"], ["Annie", "Roux"]], template: "classic" },
    { name: "Famille Blanc", members: [["Romain", "Blanc"], ["Manon", "Blanc"], ["Tom", "Blanc"]], template: "rustic" },
    { name: "Famille Fontaine", members: [["Aurélie", "Fontaine"], ["Nicolas", "Fontaine"], ["Lucas", "Fontaine"]], template: "kids" },
    { name: "Famille Garnier", members: [["Stéphane", "Garnier"], ["Valérie", "Garnier"]], template: "modern" },
    { name: "Famille Chevalier", members: [["Isabelle", "Chevalier"], ["Paul", "Chevalier"]], template: "classic" },
    { name: "Maxime et Chloé Girard", members: [["Maxime", "Girard"], ["Chloé", "Girard"]], template: "modern" },
  ];
  const individuals: Array<[string, string, string]> = [
    ["Pierre", "Marchand", "classic"],
    ["Jacques", "Marchand", "classic"],
    ["Camille", "Bertrand", "rustic"],
    ["Hugo", "Bertrand", "rustic"],
    ["Océane", "Fabre", "modern"],
    ["Julien", "Moreau", "classic"],
    ["Mehdi", "Benali", "modern"],
    ["Élodie", "Renard", "rustic"],
    ["Margaux", "Leroy", "classic"],
    ["Céline", "Petit", "modern"],
    ["Quentin", "Rousseau", "classic"],
    ["Fatou", "Diallo", "rustic"],
    ["Nadia", "Guérin", "classic"],
  ];

  const created: Array<{ id: string; guestIds: string[]; status: string }> = [];
  for (const f of families) {
    const members = f.members.map(([a, b]) => byName(a, b));
    const statuses = members.map((m) => m.seed.rsvp);
    const answered = statuses.some((s) => s !== undefined);
    const status = answered ? "answered" : "sent";
    const [inv] = await db
      .insert(invitations)
      .values({
        eventId,
        kind: "family",
        templateKey: f.template,
        recipientName: f.name,
        recipientEmail: members[0]!.seed.email ? slugEmail(members[0]!.seed.first, members[0]!.seed.last) : null,
        customMessage: "Nous serions tellement heureux de vous avoir à nos côtés pour ce grand jour.",
        status,
        guestIds: members.map((m) => m.id),
        sentAt: sent,
        viewedAt: answered ? new Date(sent.getTime() + 86_400_000) : null,
        answeredAt: answered ? new Date(sent.getTime() + 2 * 86_400_000) : null,
        expiresAt,
        createdByUserId: creator,
      })
      .returning({ id: invitations.id });
    await newToken(ctx, inv!.id, "rsvp", expiresAt, 1000, answered ? 1 : 0, answered ? new Date(sent.getTime() + 2 * 86_400_000) : null);
    created.push({ id: inv!.id, guestIds: members.map((m) => m.id), status });
  }
  for (const [first, last, template] of individuals) {
    const g = byName(first, last);
    const answered = g.seed.rsvp !== undefined;
    const [inv] = await db
      .insert(invitations)
      .values({
        eventId,
        kind: "individual",
        templateKey: template,
        recipientName: `${first} ${last}`,
        recipientEmail: g.seed.email ? slugEmail(first, last) : null,
        status: answered ? "answered" : first === "Matthieu" ? "draft" : "sent",
        guestIds: [g.id],
        sentAt: sent,
        viewedAt: answered ? new Date(sent.getTime() + 3 * 86_400_000) : null,
        answeredAt: answered ? new Date(sent.getTime() + 4 * 86_400_000) : null,
        reminderCount: !answered && g.seed.email ? 1 : 0,
        lastReminderAt: !answered && g.seed.email ? new Date(now.getTime() - 10 * 86_400_000) : null,
        expiresAt,
        createdByUserId: creator,
      })
      .returning({ id: invitations.id });
    await newToken(ctx, inv!.id, "rsvp", expiresAt, 1000, answered ? 1 : 0);
    created.push({ id: inv!.id, guestIds: [g.id], status: answered ? "answered" : "sent" });
  }

  // 2 recorded public responses.
  const dubois = created[2]!;
  await db.insert(invitationResponses).values({ invitationId: dubois.id, status: "accepted", guestsCount: 3, message: "Avec grand plaisir ! Emma a hâte.", perGuest: Object.fromEntries(dubois.guestIds.map((g) => [g, "accepted" as const])) });
  const roux = created[6]!;
  await db.insert(invitationResponses).values({ invitationId: roux.id, status: "declined", guestsCount: 0, message: "Nous serons malheureusement à l'étranger.", perGuest: Object.fromEntries(roux.guestIds.map((g) => [g, "declined" as const])) });

  // QR codes for the first two families; 3 check-ins (2 accepted + 1 duplicate on the first).
  const scannedAt = new Date("2027-06-12T15:05:00Z");
  const t1 = await newToken(ctx, created[0]!.id, "checkin", expiresAt, 1, 1, scannedAt);
  const t2 = await newToken(ctx, created[1]!.id, "checkin", expiresAt, 1, 1, new Date(scannedAt.getTime() + 4 * 60_000));
  const staff = ctx.users.nora ?? ctx.users.louis ?? null;
  await db.insert(invitationCheckins).values([
    { eventId, invitationId: created[0]!.id, tokenId: t1, result: "accepted", scannedByUserId: staff, scannedAt },
    { eventId, invitationId: created[1]!.id, tokenId: t2, result: "accepted", scannedByUserId: staff, scannedAt: new Date(scannedAt.getTime() + 4 * 60_000) },
    { eventId, invitationId: created[0]!.id, tokenId: t1, result: "duplicate", scannedByUserId: staff, scannedAt: new Date(scannedAt.getTime() + 25 * 60_000) },
  ]);

  // 8 tables, partially filled.
  const tables: Array<{ name: string; shape: "round" | "rectangle" | "square" | "oval"; capacity: number; x: number; y: number; guests: Array<[string, string]> }> = [
    { name: "Table d'honneur", shape: "rectangle", capacity: 10, x: 500, y: 100, guests: [["Bernard", "Marchand"], ["Monique", "Marchand"], ["Alain", "Bertrand"], ["Nathalie", "Bertrand"], ["Maxime", "Girard"], ["Chloé", "Girard"]] },
    { name: "Marchand", shape: "round", capacity: 8, x: 180, y: 280, guests: [["Julie", "Marchand"], ["Thomas", "Marchand"], ["Claire", "Dubois"], ["Marc", "Dubois"], ["Antoine", "Perrin"], ["Sophie", "Perrin"]] },
    { name: "Bertrand", shape: "round", capacity: 8, x: 400, y: 300, guests: [["Camille", "Bertrand"], ["Hugo", "Bertrand"], ["Sarah", "Lemoine"], ["Karim", "Lemoine"], ["Christine", "Bertrand"], ["Gérard", "Bertrand"]] },
    { name: "Amis", shape: "oval", capacity: 10, x: 640, y: 300, guests: [["Romain", "Blanc"], ["Manon", "Blanc"], ["Aurélie", "Fontaine"], ["Nicolas", "Fontaine"], ["Élodie", "Renard"], ["Margaux", "Leroy"], ["Baptiste", "Caron"]] },
    { name: "Collègues 1", shape: "round", capacity: 8, x: 860, y: 290, guests: [["Stéphane", "Garnier"], ["Valérie", "Garnier"], ["Céline", "Petit"], ["Quentin", "Rousseau"], ["Fatou", "Diallo"]] },
    { name: "Collègues 2", shape: "square", capacity: 6, x: 860, y: 520, guests: [["Isabelle", "Chevalier"], ["Nadia", "Guérin"], ["Amandine", "Lambert"]] },
    { name: "Enfants", shape: "round", capacity: 10, x: 300, y: 540, guests: [["Léa", "Marchand"], ["Emma", "Dubois"], ["Louise", "Perrin"], ["Zoé", "Bertrand"], ["Inès", "Lemoine"], ["Lucas", "Fontaine"], ["Paul", "Chevalier"]] },
    { name: "Cousins", shape: "round", capacity: 8, x: 580, y: 540, guests: [["Laura", "Costa"], ["Diego", "Costa"]] },
  ];
  let order = 0;
  for (const t of tables) {
    const [row] = await db.insert(seatingTables).values({ eventId, name: t.name, shape: t.shape, capacity: t.capacity, x: t.x, y: t.y, sortOrder: order++ }).returning({ id: seatingTables.id });
    if (t.guests.length > 0) await db.insert(seatingAssignments).values(t.guests.map(([a, b]) => ({ eventId, tableId: row!.id, guestId: byName(a, b).id })));
  }
}

async function seedBaptemeChloe(ctx: SeedContext, eventId: string): Promise<void> {
  const { db } = ctx;
  await wipeEvent(ctx, eventId);
  const guests = await seedEventGuests(ctx, eventId, CHLOE_GUESTS, {});
  const [table] = await db.insert(seatingTables).values({ eventId, name: "Table familiale", shape: "rectangle", capacity: 16, x: 500, y: 350 }).returning({ id: seatingTables.id });
  await db.insert(seatingAssignments).values(guests.slice(0, 12).map((g) => ({ eventId, tableId: table!.id, guestId: g.id })));
}

async function seedContacts(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  const louis = ctx.users.louis;
  const camille = ctx.users.camille;
  const owners = [louis, camille].filter((v): v is string => Boolean(v));
  if (owners.length === 0) return;
  await db.delete(contacts).where(inArray(contacts.ownerUserId, owners));
  if (louis) {
    const rows = await db
      .insert(contacts)
      .values(
        LOUIS_CONTACTS.map((c) => ({
          ownerUserId: louis,
          firstName: c.first,
          lastName: c.last,
          company: c.company ?? null,
          email: c.email?.trim().toLowerCase() ?? null,
          phone: c.phone ? `+33${c.phone.replace(/\s/g, "").slice(1)}` : null,
          category: c.category,
          tags: c.tags,
          notes: c.notes ?? null,
          dedupeKey: computeDedupeKey({ email: c.email, phone: c.phone }),
        })),
      )
      .returning({ id: contacts.id, category: contacts.category, firstName: contacts.firstName });
    const louisLisa = ctx.events.louisLisa;
    if (louisLisa) {
      await db.insert(contactEventLinks).values(rows.filter((r) => r.category !== "other" && r.firstName !== "Max").map((r) => ({ contactId: r.id, eventId: louisLisa }))).onConflictDoNothing();
    }
  }
  if (camille) {
    await db.insert(contacts).values(
      CAMILLE_CONTACTS.map((c) => ({
        ownerUserId: camille,
        firstName: c.first,
        lastName: c.last,
        company: c.company,
        email: c.email,
        phone: c.phone ? `+33${c.phone.replace(/\s/g, "").slice(1)}` : null,
        category: "provider",
        tags: c.tags,
        dedupeKey: computeDedupeKey({ email: c.email, phone: c.phone }),
      })),
    );
  }
}

export async function seed(ctx: SeedContext): Promise<void> {
  await seedContacts(ctx);
  if (ctx.events.louisLisa) await seedLouisLisa(ctx, ctx.events.louisLisa);
  else process.stdout.write("guests: event louisLisa missing, skipped\n");
  if (ctx.events.baptemeChloe) await seedBaptemeChloe(ctx, ctx.events.baptemeChloe);
  else process.stdout.write("guests: event baptemeChloe missing, skipped\n");
}
