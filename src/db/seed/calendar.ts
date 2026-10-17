import { eq } from "drizzle-orm";
import {
  calendarConnections,
  calendarEntries,
  cateringMenus,
  cateringPlans,
  cateringServiceSteps,
  equipmentItems,
  imageBriefs,
  musicBriefs,
  musicKeyMoments,
  shotListItems,
  venueLogistics,
  venueSpaceAllocations,
  venueSpaces,
} from "@/db/schema";
import { encryptText } from "@/lib/crypto";
import type { SeedContext } from "./context";

/**
 * Demo data for the calendar module AND the trade tools (catering, venue,
 * music, equipment, images). The trade-tool block lives here because it
 * shares the same prerequisites (events + members seeded) and the same
 * "insert if nothing exists for the event" idempotency rule.
 */
const paris = (iso: string, offset = "+02:00") => new Date(`${iso}:00${offset}`);

type EntrySeed = {
  key: string;
  owner: string;
  professional?: string;
  event?: string;
  kind: "event" | "service" | "availability" | "unavailability" | "reminder" | "other";
  title: string;
  description?: string;
  location?: string;
  startsAt: Date;
  endsAt: Date;
  allDay?: boolean;
  rrule?: string;
  exdates?: string[];
  reminder?: number;
};

export async function seed(ctx: SeedContext): Promise<void> {
  await seedCalendar(ctx);
  await seedTradeTools(ctx);
}

async function seedCalendar(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  const louisLisa = ctx.events.louisLisa;
  const bapteme = ctx.events.baptemeChloe;
  const seminaire = ctx.events.seminaireDiginumia;
  const entries: EntrySeed[] = [
    // Pros: confirmed services for the wedding (D-day 2027-06-12).
    { key: "marie-louislisa", owner: "marie", professional: "marie", event: louisLisa, kind: "service", title: "Garde d'enfants — Mariage de Louis et Lisa", description: "9 enfants, équipe de 2 (Marie + Nora). Arrivée 15h pour installation.", location: "Domaine d'Hélène, Lavaur", startsAt: paris("2027-06-12T15:00"), endsAt: paris("2027-06-13T01:00"), reminder: 1440 },
    { key: "marie-prepa", owner: "marie", professional: "marie", event: louisLisa, kind: "other", title: "Préparation malle d'activités", startsAt: paris("2027-06-10T09:00"), endsAt: paris("2027-06-10T11:00"), reminder: 60 },
    { key: "marie-conges", owner: "marie", professional: "marie", kind: "unavailability", title: "Congés d'été", startsAt: paris("2027-08-02T00:00"), endsAt: paris("2027-08-23T00:00"), allDay: true },
    { key: "marie-dispo", owner: "marie", professional: "marie", kind: "availability", title: "Disponible week-ends de septembre", startsAt: paris("2027-09-04T08:00"), endsAt: paris("2027-09-04T22:00"), rrule: "FREQ=WEEKLY;BYDAY=SA,SU;UNTIL=20270930T215959Z" },
    { key: "nora-louislisa", owner: "nora", event: louisLisa, kind: "service", title: "Renfort garde d'enfants — Mariage Louis & Lisa", location: "Domaine d'Hélène, Lavaur", startsAt: paris("2027-06-12T15:00"), endsAt: paris("2027-06-13T01:00"), reminder: 1440 },
    { key: "julien-louislisa", owner: "julien", professional: "julien", event: louisLisa, kind: "service", title: "Traiteur — Mariage Louis & Lisa (120 couverts)", location: "Domaine d'Hélène, Lavaur", startsAt: paris("2027-06-12T10:00"), endsAt: paris("2027-06-13T02:00"), reminder: 2880 },
    { key: "julien-autre", owner: "julien", professional: "julien", kind: "service", title: "Cocktail d'entreprise — 80 personnes", location: "Albi", startsAt: paris("2027-06-18T17:00"), endsAt: paris("2027-06-18T22:00") },
    { key: "helene-ferme-lundi", owner: "helene", professional: "helene", kind: "unavailability", title: "Fermé le lundi", description: "Jour de fermeture hebdomadaire du domaine.", startsAt: paris("2027-01-04T00:00", "+01:00"), endsAt: paris("2027-01-05T00:00", "+01:00"), allDay: true, rrule: "FREQ=WEEKLY;BYDAY=MO" },
    { key: "helene-louislisa", owner: "helene", professional: "helene", event: louisLisa, kind: "event", title: "Mariage de Louis et Lisa — domaine réservé", startsAt: paris("2027-06-11T14:00"), endsAt: paris("2027-06-13T12:00"), reminder: 10080 },
    { key: "helene-visite", owner: "helene", professional: "helene", kind: "other", title: "Visite du domaine — futurs mariés", startsAt: paris("2027-06-19T10:30"), endsAt: paris("2027-06-19T12:00"), rrule: "FREQ=WEEKLY;BYDAY=SA;COUNT=6" },
    { key: "theo-louislisa", owner: "theo", professional: "theo", event: louisLisa, kind: "service", title: "DJ — Mariage Louis & Lisa", description: "Installation 16h, cocktail 18h, soirée jusqu'à 4h.", location: "Domaine d'Hélène, Lavaur", startsAt: paris("2027-06-12T16:00"), endsAt: paris("2027-06-13T04:00"), reminder: 1440 },
    { key: "theo-conflit", owner: "theo", professional: "theo", kind: "service", title: "Anniversaire 40 ans — Montauban (à confirmer)", description: "Demande reçue : chevauche le mariage, à décliner.", location: "Montauban", startsAt: paris("2027-06-12T20:00"), endsAt: paris("2027-06-13T02:00") },
    { key: "ines-louislisa", owner: "ines", professional: "ines", event: louisLisa, kind: "service", title: "Reportage photo — Mariage Louis & Lisa", startsAt: paris("2027-06-12T11:00"), endsAt: paris("2027-06-13T00:00"), reminder: 1440 },
    { key: "ines-reperage", owner: "ines", professional: "ines", kind: "other", title: "Repérage lumière au domaine", location: "Lavaur", startsAt: paris("2027-05-29T17:00"), endsAt: paris("2027-05-29T19:30") },
    { key: "sofia-bapteme", owner: "sofia", professional: "sofia", event: bapteme, kind: "service", title: "Animation enfants — Baptême de Chloé", location: "Bordeaux", startsAt: paris("2027-09-19T11:00"), endsAt: paris("2027-09-19T18:00"), reminder: 1440 },
    // Organisers: the D-day itself.
    { key: "louis-jourj", owner: "louis", event: louisLisa, kind: "event", title: "Notre mariage", description: "Cérémonie 15h, vin d'honneur 17h, dîner 20h.", location: "Domaine d'Hélène, Lavaur", startsAt: paris("2027-06-12T14:00"), endsAt: paris("2027-06-13T04:00"), reminder: 1440 },
    { key: "louis-essayage", owner: "louis", kind: "reminder", title: "Dernier essayage costume", startsAt: paris("2027-06-05T10:00"), endsAt: paris("2027-06-05T11:00"), reminder: 1440 },
    { key: "lisa-jourj", owner: "lisa", event: louisLisa, kind: "event", title: "Notre mariage", location: "Domaine d'Hélène, Lavaur", startsAt: paris("2027-06-12T14:00"), endsAt: paris("2027-06-13T04:00"), reminder: 1440 },
    { key: "paul-bapteme", owner: "paul", event: bapteme, kind: "event", title: "Baptême de Chloé", location: "Bordeaux", startsAt: paris("2027-09-19T10:30"), endsAt: paris("2027-09-19T18:00"), reminder: 2880 },
    { key: "paul-seminaire", owner: "paul", event: seminaire, kind: "event", title: "Séminaire DIGINUMIA", startsAt: paris("2027-03-25T09:00", "+01:00"), endsAt: paris("2027-03-26T17:00", "+01:00"), reminder: 10080 },
  ];

  for (const e of entries) {
    const ownerUserId = ctx.users[e.owner];
    if (!ownerUserId) continue;
    const professionalId = e.professional ? (ctx.professionals[e.professional] ?? null) : null;
    const values = {
      ownerUserId,
      professionalId,
      eventId: e.event ?? null,
      kind: e.kind,
      title: e.title,
      description: e.description ?? null,
      location: e.location ?? null,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay ?? false,
      timezone: "Europe/Paris",
      rrule: e.rrule ?? null,
      exdates: e.exdates ?? [],
      reminderMinutesBefore: e.reminder ?? null,
      icalUid: `demo-${e.key}@sousnosailes.test`,
    };
    await db.insert(calendarEntries).values(values).onConflictDoUpdate({ target: [calendarEntries.ownerUserId, calendarEntries.icalUid], set: values });
  }

  // Théo once connected Google Agenda; the token has expired: shows the "reconnect" state.
  const theo = ctx.users.theo;
  if (theo) {
    const values = {
      userId: theo,
      provider: "google" as const,
      externalAccountEmail: "theo.dj@sousnosailes.test",
      externalCalendarId: "primary",
      accessTokenEncrypted: encryptText("demo-expired-access-token"),
      refreshTokenEncrypted: null,
      accessTokenExpiresAt: new Date(ctx.now.getTime() - 30 * 86_400_000),
      scopes: ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.calendarlist.readonly"],
      status: "expired" as const,
      syncDirection: "export_only",
      lastSyncAt: new Date(ctx.now.getTime() - 31 * 86_400_000),
      lastError: "Jeton expiré : reconnectez le calendrier.",
    };
    await db.insert(calendarConnections).values(values).onConflictDoUpdate({ target: [calendarConnections.userId, calendarConnections.provider], set: values });
  }
}

async function seedTradeTools(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  const eventId = ctx.events.louisLisa;
  if (!eventId) return;
  const louis = ctx.users.louis ?? null;

  // Catering: 120 covers.
  await db
    .insert(cateringPlans)
    .values({ eventId, manualAdults: 8, manualChildren: 0, mealSplit: { cocktail: 120, dinner: 120, brunch: 60 }, deliveryNotes: "Livraison samedi 10h par l'accès de service (portail ouest), quai à 30 m de l'office.", equipmentNotes: "Office équipé : 2 fours, chambre froide 4 m³. Vaisselle fournie par le domaine, verrerie par le traiteur.", constraints: "Coupure électrique interdite entre 19h et 2h (DJ). Tri des déchets obligatoire.", updatedByUserId: louis })
    .onConflictDoUpdate({ target: cateringPlans.eventId, set: { mealSplit: { cocktail: 120, dinner: 120, brunch: 60 }, manualAdults: 8 } });
  if (!(await exists(() => db.select({ id: cateringMenus.id }).from(cateringMenus).where(eq(cateringMenus.eventId, eventId)).limit(1)))) {
    await db.insert(cateringMenus).values([
      { eventId, moment: "cocktail", name: "Cocktail champêtre", description: "12 pièces / personne : gougères, tartare de daurade, pissaladière, brochettes melon-jambon.", pricePerCoverCents: 2800, sortOrder: 1 },
      { eventId, moment: "dinner", name: "Menu Lavaur", description: "Ravioles de homard · Filet de bœuf, jus au thym, légumes du potager · Fromages · Pièce montée & buffet de desserts.", pricePerCoverCents: 8900, sortOrder: 2 },
      { eventId, moment: "children", name: "Menu enfants", description: "Nuggets de volaille maison, purée, compote. Alternatives végétarienne et sans gluten sur demande.", pricePerCoverCents: 1800, sortOrder: 3 },
      { eventId, moment: "brunch", name: "Brunch du dimanche", description: "Viennoiseries, œufs brouillés, salades, fruits.", pricePerCoverCents: 2400, sortOrder: 4 },
    ]);
  }
  if (!(await exists(() => db.select({ id: cateringServiceSteps.id }).from(cateringServiceSteps).where(eq(cateringServiceSteps.eventId, eventId)).limit(1)))) {
    await db.insert(cateringServiceSteps).values([
      { eventId, title: "Mise en place office et buffets", startsAt: paris("2027-06-12T10:00"), endsAt: paris("2027-06-12T16:00"), sortOrder: 1 },
      { eventId, title: "Service du cocktail", startsAt: paris("2027-06-12T17:00"), endsAt: paris("2027-06-12T19:30"), notes: "Terrasse, 6 serveurs.", sortOrder: 2 },
      { eventId, title: "Dîner des enfants", startsAt: paris("2027-06-12T19:00"), endsAt: paris("2027-06-12T20:00"), notes: "Salle des enfants, 9 couverts, régimes transmis par la garde.", sortOrder: 3 },
      { eventId, title: "Dîner", startsAt: paris("2027-06-12T20:00"), endsAt: paris("2027-06-12T23:30"), notes: "Orangerie, 120 couverts.", sortOrder: 4 },
      { eventId, title: "Pièce montée", startsAt: paris("2027-06-12T23:30"), endsAt: paris("2027-06-13T00:00"), sortOrder: 5 },
    ]);
  }

  // Venue: spaces of the domaine.
  if (!(await exists(() => db.select({ id: venueSpaces.id }).from(venueSpaces).where(eq(venueSpaces.eventId, eventId)).limit(1)))) {
    const spaces = await db
      .insert(venueSpaces)
      .values([
        { eventId, name: "Chapelle", capacity: 120, usage: "ceremony", notes: "Cérémonie laïque possible, sono fournie.", sortOrder: 1 },
        { eventId, name: "Terrasse des platanes", capacity: 200, usage: "cocktail", notes: "Ombragée, accès cuisine direct.", sortOrder: 2 },
        { eventId, name: "Orangerie", capacity: 150, usage: "dinner", notes: "Tables rondes de 10, piste au centre.", sortOrder: 3 },
        { eventId, name: "Salle des enfants", capacity: 30, usage: "kids", notes: "Attenante à l'Orangerie, sanitaires enfants, coin sieste.", sortOrder: 4 },
        { eventId, name: "Office traiteur", capacity: 12, usage: "logistics", sortOrder: 5 },
      ])
      .returning({ id: venueSpaces.id, name: venueSpaces.name });
    const byName = (n: string) => spaces.find((s) => s.name === n)?.id;
    await db.insert(venueSpaceAllocations).values([
      { eventId, spaceId: byName("Chapelle")!, label: "Cérémonie", startsAt: paris("2027-06-12T15:00"), endsAt: paris("2027-06-12T16:00") },
      { eventId, spaceId: byName("Terrasse des platanes")!, label: "Vin d'honneur", startsAt: paris("2027-06-12T17:00"), endsAt: paris("2027-06-12T19:30") },
      { eventId, spaceId: byName("Orangerie")!, label: "Dîner et soirée", startsAt: paris("2027-06-12T20:00"), endsAt: paris("2027-06-13T04:00") },
      { eventId, spaceId: byName("Salle des enfants")!, label: "Espace enfants", startsAt: paris("2027-06-12T15:30"), endsAt: paris("2027-06-13T01:00") },
    ]);
  }
  await db
    .insert(venueLogistics)
    .values({
      eventId,
      electricalNotes: "Orangerie : 2 × 32A triphasé + 6 × 16A. Terrasse : 4 × 16A. Groupe électrogène de secours 20 kVA.",
      accessNotes: "Portail principal pour les invités (parking 80 places). Portail ouest pour les prestataires (camions ≤ 12 t).",
      noiseNotes: "Musique extérieure jusqu'à 23h, intérieur jusqu'à 4h portes fermées (arrêté municipal).",
      installationPlan: "Vendredi 14h : mobilier et décoration\nSamedi 9h : fleuriste · 10h : traiteur · 15h : équipe garde d'enfants · 16h : DJ\nDimanche 12h : libération des lieux",
      otherConstraints: "Pas de feu d'artifice (zone boisée). Lanternes volantes interdites. Bassin non clôturé : surveillance enfants.",
      updatedByUserId: louis,
    })
    .onConflictDoNothing();

  // Music brief + key moments.
  await db
    .insert(musicBriefs)
    .values({
      eventId,
      preferences: "Cocktail : jazz manouche et soul. Dîner : acoustique discret. Soirée : généraliste dansant, funk/disco, années 80-2000, un peu de latino.",
      forbidden: "Pas de Macarena ni de chenille. Pas de hard rock. Rien à paroles explicites avant le départ des enfants (vers 1h).",
      playlistText: "Perfect — Ed Sheeran (ouverture de bal)\nSeptember — Earth, Wind & Fire\nLes Champs-Élysées — Joe Dassin\nDon't Stop Me Now — Queen\nDanza Kuduro — Don Omar",
      technicalNeeds: "2 micros HF pour les discours (cocktail + dîner), lumière d'ambiance chaude pour le dîner, machine à brouillard légère pour l'ouverture de bal.",
      installationNotes: "Installation à partir de 16h dans l'Orangerie, régie à droite de la piste, 2 × 16A dédiés.",
      updatedByUserId: louis,
    })
    .onConflictDoNothing();
  if (!(await exists(() => db.select({ id: musicKeyMoments.id }).from(musicKeyMoments).where(eq(musicKeyMoments.eventId, eventId)).limit(1)))) {
    await db.insert(musicKeyMoments).values([
      { eventId, title: "Entrée des mariés (cérémonie)", songTitle: "A Thousand Years", artist: "Christina Perri", startsAt: paris("2027-06-12T15:05"), sortOrder: 1 },
      { eventId, title: "Entrée en salle", songTitle: "Can't Stop the Feeling!", artist: "Justin Timberlake", startsAt: paris("2027-06-12T20:00"), sortOrder: 2 },
      { eventId, title: "Ouverture de bal", songTitle: "Perfect", artist: "Ed Sheeran", startsAt: paris("2027-06-13T00:00"), notes: "Enchaîner sur September pour lancer la piste.", sortOrder: 3 },
      { eventId, title: "Pièce montée", songTitle: "Sugar", artist: "Maroon 5", startsAt: paris("2027-06-12T23:30"), sortOrder: 4 },
    ]);
  }

  // DJ equipment.
  const theoMember = ctx.members["louisLisa:theo"] ?? null;
  if (!(await exists(() => db.select({ id: equipmentItems.id }).from(equipmentItems).where(eq(equipmentItems.eventId, eventId)).limit(1)))) {
    await db.insert(equipmentItems).values([
      { eventId, memberId: theoMember, name: "Enceinte active 15\" (façade)", quantity: 2, providedBy: "provider", powerNeeds: "2 × 16A", sortOrder: 1 },
      { eventId, memberId: theoMember, name: "Caisson de basses 18\"", quantity: 2, providedBy: "provider", powerNeeds: "1 × 16A", sortOrder: 2 },
      { eventId, memberId: theoMember, name: "Contrôleur DJ + ordinateur", quantity: 1, providedBy: "provider", powerNeeds: "Multiprise onduleur", sortOrder: 3 },
      { eventId, memberId: theoMember, name: "Micro HF main", quantity: 2, providedBy: "provider", sortOrder: 4 },
      { eventId, memberId: theoMember, name: "Barre LED d'ambiance", quantity: 6, providedBy: "provider", powerNeeds: "1 × 16A", sortOrder: 5 },
      { eventId, memberId: theoMember, name: "Pied d'enceinte", quantity: 2, providedBy: "provider", sortOrder: 6 },
      { eventId, memberId: null, name: "Sono de la chapelle (cérémonie)", quantity: 1, providedBy: "venue", notes: "Fournie par le domaine, câble mini-jack.", sortOrder: 7 },
    ]);
  }

  // Photo brief + shot list.
  await db
    .insert(imageBriefs)
    .values({
      eventId,
      brief: "Reportage naturel, peu de poses. Noir et blanc bienvenu pour la cérémonie. Photos de couple au coucher du soleil (vers 21h15) dans l'allée de platanes. Livraison : galerie privée sous 6 semaines.",
      usefulContacts: "Témoin référent : Maxime — 06 00 00 00 10\nWedding planner : Camille Ferrand (via messages)",
      updatedByUserId: louis,
    })
    .onConflictDoNothing();
  if (!(await exists(() => db.select({ id: shotListItems.id }).from(shotListItems).where(eq(shotListItems.eventId, eventId)).limit(1)))) {
    await db.insert(shotListItems).values([
      { eventId, kind: "moment", title: "Préparatifs de Lisa", startsAt: paris("2027-06-12T12:00"), location: "Suite du domaine", releaseConsentCollected: true, sortOrder: 1 },
      { eventId, kind: "moment", title: "Échange des alliances", startsAt: paris("2027-06-12T15:30"), location: "Chapelle", releaseConsentCollected: true, sortOrder: 2 },
      { eventId, kind: "moment", title: "Sortie de cérémonie (pétales)", startsAt: paris("2027-06-12T16:00"), location: "Parvis de la chapelle", releaseConsentCollected: false, sortOrder: 3 },
      { eventId, kind: "moment", title: "Photos de groupe par famille", startsAt: paris("2027-06-12T16:30"), location: "Escalier de l'Orangerie", notes: "Liste des groupes fournie par Camille.", releaseConsentCollected: false, sortOrder: 4 },
      { eventId, kind: "moment", title: "Photos de couple — golden hour", startsAt: paris("2027-06-12T21:15"), location: "Allée de platanes", releaseConsentCollected: true, sortOrder: 5 },
      { eventId, kind: "moment", title: "Ouverture de bal", startsAt: paris("2027-06-13T00:00"), location: "Orangerie", releaseConsentCollected: true, sortOrder: 6 },
      { eventId, kind: "location", title: "Allée de platanes", notes: "Lumière rasante ouest à partir de 20h45.", sortOrder: 10 },
      { eventId, kind: "location", title: "Escalier de l'Orangerie", notes: "Idéal pour les groupes jusqu'à 40 personnes.", sortOrder: 11 },
      { eventId, kind: "location", title: "Bassin et roseraie", notes: "Reflets, attention aux enfants (zone non clôturée).", sortOrder: 12 },
    ]);
  }
}

/** True when at least one row matches (used for "insert demo rows only once"). */
async function exists(query: () => Promise<unknown[]>): Promise<boolean> {
  return (await query()).length > 0;
}
