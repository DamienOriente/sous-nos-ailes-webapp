import { and, eq } from "drizzle-orm";
import {
  childAttendance,
  childAuthorizedPersons,
  childCareAssignments,
  childEmergencyContacts,
  childHandoverRecords,
  childSensitiveInformation,
  childcareActivities,
  consentRecords,
  eventChildren,
} from "@/db/schema";
import { encryptText } from "@/lib/crypto";
import type { SeedContext } from "./context";

/**
 * Demo children for the childcare module. Idempotent: children are matched by
 * (event, first name, last name); sub-rows are only inserted when missing.
 * Health data is fictitious and encrypted exactly like real data would be.
 * Runs after events/guests (needs ctx.events + ctx.members).
 */
type ChildSeed = {
  firstName: string;
  lastName: string;
  ageYears: number;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  careInstructions?: string;
  dietaryPreference?: string;
  arrival: string; // HH:mm Paris time on the event day
  departure: string;
  contacts: Array<{ name: string; relationship: string; phone: string }>;
  authorized: Array<{ name: string; relationship: string; phone?: string; hint?: string; primary?: boolean }>;
  sensitive?: { allergies?: string; healthNotes?: string; consentBy: string };
  assignTo?: string; // member key suffix (marie, nora, sofia)
};

const parisInstant = (day: string, hm: string) => new Date(`${day}T${hm}:00+02:00`); // June: CEST

const LOUIS_LISA_CHILDREN: ChildSeed[] = [
  { firstName: "Léa", lastName: "Marchand", ageYears: 6, guardianName: "Claire Marchand", guardianPhone: "06 11 22 33 01", guardianEmail: "claire.marchand@sousnosailes.test", careInstructions: "Timide au début, adore dessiner.", arrival: "15:30", departure: "23:00", contacts: [{ name: "Antoine Marchand", relationship: "père", phone: "06 11 22 33 02" }], authorized: [{ name: "Claire Marchand", relationship: "mère", phone: "06 11 22 33 01", hint: "Connue de l'équipe (sœur du marié)", primary: true }, { name: "Antoine Marchand", relationship: "père", phone: "06 11 22 33 02", hint: "Pièce d'identité" }], sensitive: { allergies: "Arachide — réaction sévère. Trousse d'urgence (stylo adrénaline) dans le sac rose, appeler le 15 immédiatement.", consentBy: "Claire Marchand" }, assignTo: "marie" },
  { firstName: "Noah", lastName: "Marchand", ageYears: 3, guardianName: "Claire Marchand", guardianPhone: "06 11 22 33 01", careInstructions: "Sieste vers 14h si possible, doudou lapin.", dietaryPreference: "sans porc", arrival: "15:30", departure: "22:00", contacts: [{ name: "Antoine Marchand", relationship: "père", phone: "06 11 22 33 02" }], authorized: [{ name: "Claire Marchand", relationship: "mère", phone: "06 11 22 33 01", primary: true }, { name: "Antoine Marchand", relationship: "père", phone: "06 11 22 33 02" }], assignTo: "marie" },
  { firstName: "Inaya", lastName: "Dubois", ageYears: 8, guardianName: "Sarah Dubois", guardianPhone: "06 22 33 44 01", dietaryPreference: "végétarien", arrival: "16:00", departure: "00:30", contacts: [{ name: "Karim Dubois", relationship: "père", phone: "06 22 33 44 02" }, { name: "Mamie Fatima", relationship: "grand-mère", phone: "05 61 00 00 01" }], authorized: [{ name: "Sarah Dubois", relationship: "mère", primary: true }, { name: "Karim Dubois", relationship: "père", hint: "Pièce d'identité" }], sensitive: { healthNotes: "Asthme léger : Ventoline dans la pochette bleue, 2 bouffées si essoufflement à l'effort.", consentBy: "Sarah Dubois" }, assignTo: "marie" },
  { firstName: "Tom", lastName: "Dubois", ageYears: 5, guardianName: "Sarah Dubois", guardianPhone: "06 22 33 44 01", careInstructions: "Très actif, surveiller près du bassin.", arrival: "16:00", departure: "00:30", contacts: [{ name: "Karim Dubois", relationship: "père", phone: "06 22 33 44 02" }], authorized: [{ name: "Sarah Dubois", relationship: "mère", primary: true }, { name: "Karim Dubois", relationship: "père" }], assignTo: "marie" },
  { firstName: "Jade", lastName: "Petit", ageYears: 11, guardianName: "Émilie Petit", guardianPhone: "06 33 44 55 01", careInstructions: "Peut aider avec les plus petits, aime la musique.", arrival: "17:00", departure: "01:00", contacts: [{ name: "Marc Petit", relationship: "père", phone: "06 33 44 55 02" }], authorized: [{ name: "Émilie Petit", relationship: "mère", primary: true }, { name: "Marc Petit", relationship: "père" }, { name: "Louise Petit", relationship: "tante", hint: "Pièce d'identité + confirmation téléphonique de la mère" }], assignTo: "marie" },
  { firstName: "Gabriel", lastName: "Roux", ageYears: 2, guardianName: "Pauline Roux", guardianPhone: "06 44 55 66 01", careInstructions: "Couches dans le sac vert, biberon à 19h.", arrival: "15:00", departure: "21:30", contacts: [{ name: "Hugo Roux", relationship: "père", phone: "06 44 55 66 02" }], authorized: [{ name: "Pauline Roux", relationship: "mère", primary: true }, { name: "Hugo Roux", relationship: "père" }], sensitive: { allergies: "Intolérance au lactose (lait de riz fourni par les parents).", healthNotes: "Eczéma : crème dans la trousse si plaques.", consentBy: "Pauline Roux" }, assignTo: "nora" },
  { firstName: "Mila", lastName: "Garcia", ageYears: 7, guardianName: "Lucía Garcia", guardianPhone: "06 55 66 77 01", dietaryPreference: "sans gluten", arrival: "16:30", departure: "23:30", contacts: [{ name: "Diego Garcia", relationship: "père", phone: "06 55 66 77 02" }], authorized: [{ name: "Lucía Garcia", relationship: "mère", primary: true }, { name: "Diego Garcia", relationship: "père" }], assignTo: "nora" },
  { firstName: "Louis", lastName: "Bernard", ageYears: 9, guardianName: "Céline Bernard", guardianPhone: "06 66 77 88 01", arrival: "16:30", departure: "00:00", contacts: [{ name: "Julien Bernard", relationship: "père", phone: "06 66 77 88 02" }], authorized: [{ name: "Céline Bernard", relationship: "mère", primary: true }, { name: "Julien Bernard", relationship: "père" }], assignTo: "nora" },
  { firstName: "Alice", lastName: "Moreau", ageYears: 4, guardianName: "Camille Moreau", guardianPhone: "06 77 88 99 01", careInstructions: "Ne mange pas de poisson (goût).", arrival: "16:00", departure: "22:30", contacts: [{ name: "Nicolas Moreau", relationship: "père", phone: "06 77 88 99 02" }], authorized: [{ name: "Camille Moreau", relationship: "mère", primary: true }, { name: "Nicolas Moreau", relationship: "père" }], assignTo: "nora" },
];

const BAPTEME_CHILDREN: ChildSeed[] = [
  { firstName: "Chloé", lastName: "Nguyen", ageYears: 1, guardianName: "Paul Nguyen", guardianPhone: "06 88 99 00 01", arrival: "11:00", departure: "18:00", contacts: [{ name: "Anh Nguyen", relationship: "mère", phone: "06 88 99 00 02" }], authorized: [{ name: "Paul Nguyen", relationship: "père", primary: true }, { name: "Anh Nguyen", relationship: "mère" }], assignTo: "sofia" },
  { firstName: "Maxime", lastName: "Nguyen", ageYears: 5, guardianName: "Paul Nguyen", guardianPhone: "06 88 99 00 01", arrival: "11:00", departure: "18:00", contacts: [{ name: "Anh Nguyen", relationship: "mère", phone: "06 88 99 00 02" }], authorized: [{ name: "Paul Nguyen", relationship: "père", primary: true }, { name: "Anh Nguyen", relationship: "mère" }], assignTo: "sofia" },
  { firstName: "Sofia", lastName: "Lemaire", ageYears: 6, guardianName: "Julie Lemaire", guardianPhone: "06 99 00 11 01", dietaryPreference: "végétarien", arrival: "11:30", departure: "17:30", contacts: [{ name: "Thomas Lemaire", relationship: "père", phone: "06 99 00 11 02" }], authorized: [{ name: "Julie Lemaire", relationship: "mère", primary: true }], assignTo: "sofia" },
  { firstName: "Ethan", lastName: "Lemaire", ageYears: 3, guardianName: "Julie Lemaire", guardianPhone: "06 99 00 11 01", arrival: "11:30", departure: "17:30", contacts: [{ name: "Thomas Lemaire", relationship: "père", phone: "06 99 00 11 02" }], authorized: [{ name: "Julie Lemaire", relationship: "mère", primary: true }], assignTo: "sofia" },
];

async function seedEventChildren(ctx: SeedContext, eventKey: string, day: string, children: ChildSeed[], registeredBy: string | undefined) {
  const { db } = ctx;
  const eventId = ctx.events[eventKey];
  if (!eventId) {
    process.stdout.write(`children: event ${eventKey} missing in ctx, skipped\n`);
    return [];
  }
  const ids: Array<{ id: string; seed: ChildSeed }> = [];
  for (const c of children) {
    const [existing] = await db
      .select({ id: eventChildren.id })
      .from(eventChildren)
      .where(and(eq(eventChildren.eventId, eventId), eq(eventChildren.firstName, c.firstName), eq(eventChildren.lastName, c.lastName)))
      .limit(1);
    let id = existing?.id;
    if (!id) {
      const [row] = await db
        .insert(eventChildren)
        .values({
          eventId,
          firstName: c.firstName,
          lastName: c.lastName,
          ageYears: c.ageYears,
          guardianName: c.guardianName,
          guardianPhone: c.guardianPhone,
          guardianEmail: c.guardianEmail ?? null,
          careInstructions: c.careInstructions ?? null,
          dietaryPreference: c.dietaryPreference ?? null,
          expectedArrivalAt: parisInstant(day, c.arrival),
          expectedDepartureAt: parisInstant(day, c.departure),
          registeredByUserId: registeredBy ?? null,
          guardianInformedAt: ctx.now,
        })
        .returning({ id: eventChildren.id });
      id = row!.id;
    }
    ids.push({ id, seed: c });

    for (const [i, ec] of c.contacts.entries()) {
      const [has] = await db.select({ id: childEmergencyContacts.id }).from(childEmergencyContacts).where(and(eq(childEmergencyContacts.childId, id), eq(childEmergencyContacts.name, ec.name))).limit(1);
      if (!has) await db.insert(childEmergencyContacts).values({ childId: id, name: ec.name, relationship: ec.relationship, phone: ec.phone, priority: i + 1 });
    }
    for (const ap of c.authorized) {
      const [has] = await db.select({ id: childAuthorizedPersons.id }).from(childAuthorizedPersons).where(and(eq(childAuthorizedPersons.childId, id), eq(childAuthorizedPersons.name, ap.name))).limit(1);
      if (!has) await db.insert(childAuthorizedPersons).values({ childId: id, name: ap.name, relationship: ap.relationship, phone: ap.phone ?? null, identityCheckHint: ap.hint ?? null, isPrimaryGuardian: ap.primary ?? false });
    }
    if (c.sensitive) {
      const [has] = await db.select({ childId: childSensitiveInformation.childId }).from(childSensitiveInformation).where(eq(childSensitiveInformation.childId, id)).limit(1);
      if (!has) {
        await db.insert(childSensitiveInformation).values({
          childId: id,
          allergiesEncrypted: c.sensitive.allergies ? encryptText(c.sensitive.allergies) : null,
          healthNotesEncrypted: c.sensitive.healthNotes ? encryptText(c.sensitive.healthNotes) : null,
          hasAllergies: Boolean(c.sensitive.allergies),
          hasHealthNotes: Boolean(c.sensitive.healthNotes),
          consentGivenByName: c.sensitive.consentBy,
          consentGivenAt: ctx.now,
          consentRecordedByUserId: registeredBy ?? null,
        });
        if (registeredBy) await db.insert(consentRecords).values({ userId: registeredBy, purpose: "child_health_data", granted: "granted", policyVersion: "v1" });
      }
    }
    if (c.assignTo) {
      const memberId = ctx.members[`${eventKey}:${c.assignTo}`];
      if (memberId) await db.insert(childCareAssignments).values({ eventId, childId: id, memberId, assignedByUserId: registeredBy ?? null }).onConflictDoNothing();
      else process.stdout.write(`children: member ${eventKey}:${c.assignTo} missing, assignment skipped\n`);
    }
  }
  return ids;
}

export async function seed(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  const louisLisaDay = "2027-06-12";
  const louisLisa = await seedEventChildren(ctx, "louisLisa", louisLisaDay, LOUIS_LISA_CHILDREN, ctx.users.louis);
  await seedEventChildren(ctx, "baptemeChloe", "2027-09-19", BAPTEME_CHILDREN, ctx.users.paul);

  const eventId = ctx.events.louisLisa;
  const marie = ctx.users.marie;
  if (!eventId || !marie || louisLisa.length < 3) return;

  // Attendance demo: two check-ins (Léa, Noah) and one full handover (Jade, by Marie to the aunt).
  const byName = (first: string) => louisLisa.find((c) => c.seed.firstName === first);
  const lea = byName("Léa");
  const noah = byName("Noah");
  const jade = byName("Jade");
  for (const child of [lea, noah, jade]) {
    if (!child) continue;
    const [has] = await db.select({ id: childAttendance.id }).from(childAttendance).where(eq(childAttendance.childId, child.id)).limit(1);
    if (has) continue;
    await db.insert(childAttendance).values({ eventId, childId: child.id, kind: "check_in", recordedByUserId: marie, recordedAt: parisInstant(louisLisaDay, child.seed.arrival), note: null });
  }
  if (jade) {
    const [has] = await db.select({ id: childHandoverRecords.id }).from(childHandoverRecords).where(eq(childHandoverRecords.childId, jade.id)).limit(1);
    if (!has) {
      const [aunt] = await db.select({ id: childAuthorizedPersons.id, name: childAuthorizedPersons.name }).from(childAuthorizedPersons).where(and(eq(childAuthorizedPersons.childId, jade.id), eq(childAuthorizedPersons.name, "Louise Petit"))).limit(1);
      const handedAt = parisInstant(louisLisaDay, "23:45");
      await db.insert(childHandoverRecords).values({ eventId, childId: jade.id, authorizedPersonId: aunt?.id ?? null, receivedByName: aunt?.name ?? "Louise Petit", identityVerifiedHow: "Pièce d'identité présentée — confirmation téléphonique de la mère", confirmedByUserId: marie, handedOverAt: handedAt, note: "Sac et veste rendus." });
      await db.insert(childAttendance).values({ eventId, childId: jade.id, kind: "check_out", recordedByUserId: marie, recordedAt: handedAt, note: "Remise à Louise Petit" });
    }
  }

  // Activity program of the kids' corner.
  const [hasActivities] = await db.select({ id: childcareActivities.id }).from(childcareActivities).where(eq(childcareActivities.eventId, eventId)).limit(1);
  if (!hasActivities) {
    await db.insert(childcareActivities).values([
      { eventId, title: "Accueil et jeux libres", description: "Coin lecture, Kapla, dessin.", startsAt: parisInstant(louisLisaDay, "15:30"), endsAt: parisInstant(louisLisaDay, "17:00"), location: "Salle des enfants", minAge: 2, maxAge: 11 },
      { eventId, title: "Atelier couronnes de fleurs", startsAt: parisInstant(louisLisaDay, "17:00"), endsAt: parisInstant(louisLisaDay, "18:00"), location: "Terrasse ombragée", minAge: 4, maxAge: 11 },
      { eventId, title: "Dîner des enfants", description: "Menu enfants du traiteur, régimes transmis.", startsAt: parisInstant(louisLisaDay, "19:00"), endsAt: parisInstant(louisLisaDay, "20:00"), location: "Salle des enfants" },
      { eventId, title: "Projection et coucher des petits", description: "Film d'animation, matelas et duvets pour les 2–5 ans.", startsAt: parisInstant(louisLisaDay, "21:00"), endsAt: parisInstant(louisLisaDay, "23:00"), location: "Salle des enfants", minAge: 2, maxAge: 6 },
    ]);
  }
}
