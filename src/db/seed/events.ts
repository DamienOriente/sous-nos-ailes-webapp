import { and, eq } from "drizzle-orm";
import {
  auditLogs,
  calendarEntries,
  channelMembers,
  checklistTemplates,
  eventBudgetLines,
  eventChannels,
  eventExpenses,
  eventMembers,
  eventMilestones,
  eventPermissions,
  eventProfessionals,
  eventTasks,
  events,
  messages,
} from "@/db/schema";
import type { EventRole } from "@/modules/authorization";
import { zonedDateTimeToUtc } from "@/modules/events/application/event-service";
import { buildChecklist } from "@/modules/events/domain/checklist";
import type { SeedContext } from "./context";

/**
 * Demo events. Idempotent: an event is identified by (owner, name); when it
 * already exists we only refresh the context ids and leave data untouched.
 */
type EventSpec = {
  key: string;
  ownerKey: string;
  name: string;
  type: "wedding" | "baptism" | "seminar";
  eventDate: string;
  startTime: string;
  endTime: string;
  venueName: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  department: string;
  expectedGuests: number;
  expectedChildren: number;
  budgetCents: number;
  description: string;
  preferences: string;
  members: Array<{ userKey: string; role: EventRole; categorySlug?: string; proKey?: string; title?: string }>;
  providers: Array<{ proKey?: string; externalName?: string; externalEmail?: string; externalPhone?: string; categorySlug: string; status: "shortlisted" | "requested" | "quoted" | "confirmed" | "declined" | "cancelled"; quoteCents?: number; memberUserKey?: string; serviceStart?: string; serviceEnd?: string; notes?: string }>;
  milestones: Array<{ title: string; start: string; end?: string; location?: string; categorySlugs: string[]; description?: string }>;
  budget: Array<{ category: string; label: string; plannedCents: number; providerIndex?: number; expenses?: Array<{ label: string; amountCents: number; status: "planned" | "committed" | "paid"; paidAt?: string }> }>;
  doneTasks: string[];
  channels: Array<{ name: string; description: string; kind: "topic" | "coordination"; memberKeys: string[]; messages: Array<{ from: string; body: string; minutesAgo: number }> }>;
  generalMessages: Array<{ from: string; body: string; minutesAgo: number }>;
  grants?: Array<{ userKey: string; permission: string; byUserKey: string }>;
};

const SPECS: EventSpec[] = [
  {
    key: "louisLisa",
    ownerKey: "louis",
    name: "Mariage de Louis et Lisa",
    type: "wedding",
    eventDate: "2027-06-12",
    startTime: "15:00",
    endTime: "23:59",
    venueName: "Domaine des Tilleuls",
    addressLine1: "Chemin des Tilleuls",
    postalCode: "81500",
    city: "Lavaur",
    department: "81",
    expectedGuests: 120,
    expectedChildren: 14,
    budgetCents: 3_500_000,
    description: "Cérémonie laïque dans le parc, cocktail sur la terrasse puis dîner dans l'orangerie. Quatorze enfants de 2 à 11 ans : un espace dédié avec garde professionnelle est prévu.",
    preferences: "Ambiance champêtre et chaleureuse. Menu végétarien pour une dizaine d'invités. Pas de feu d'artifice (voisinage).",
    members: [
      { userKey: "louis", role: "owner" },
      { userKey: "lisa", role: "co_organizer" },
      { userKey: "camille", role: "wedding_planner", categorySlug: "wedding-planner", proKey: "camille" },
      { userKey: "marie", role: "provider", categorySlug: "garde-enfants-evenementielle", proKey: "marie", title: "Responsable espace enfants" },
      { userKey: "nora", role: "staff", categorySlug: "garde-enfants-evenementielle" },
      { userKey: "julien", role: "provider", categorySlug: "traiteur", proKey: "julien" },
      { userKey: "helene", role: "provider", categorySlug: "domaine-reception", proKey: "helene" },
      { userKey: "theo", role: "provider", categorySlug: "dj", proKey: "theo" },
      { userKey: "ines", role: "provider", categorySlug: "photographe", proKey: "ines" },
    ],
    providers: [
      { proKey: "marie", categorySlug: "garde-enfants-evenementielle", status: "confirmed", quoteCents: 95_000, memberUserKey: "marie", serviceStart: "14:30", serviceEnd: "23:00", notes: "2 encadrantes (Marie + Nora), espace enfants dans la grange." },
      { proKey: "helene", categorySlug: "domaine-reception", status: "confirmed", quoteCents: 850_000, memberUserKey: "helene", serviceStart: "10:00", serviceEnd: "02:00" },
      { proKey: "julien", categorySlug: "traiteur", status: "quoted", quoteCents: 1_250_000, memberUserKey: "julien", serviceStart: "16:00", serviceEnd: "01:00", notes: "Devis v2 reçu : option menu enfants à confirmer." },
      { proKey: "ines", categorySlug: "photographe", status: "confirmed", quoteCents: 240_000, memberUserKey: "ines", serviceStart: "13:00", serviceEnd: "23:30" },
      { proKey: "theo", categorySlug: "dj", status: "requested", memberUserKey: "theo", serviceStart: "19:00", serviceEnd: "03:00" },
      { proKey: "camille", categorySlug: "wedding-planner", status: "confirmed", quoteCents: 320_000, memberUserKey: "camille" },
      { externalName: "Fleurs & Co", externalEmail: "contact@fleurs-and-co.test", externalPhone: "05 61 00 00 00", categorySlug: "fleuriste", status: "shortlisted", notes: "Recommandé par Hélène." },
      { categorySlug: "patissier", status: "shortlisted" },
    ],
    milestones: [
      { title: "Arrivée des prestataires & installation", start: "10:00", end: "14:00", location: "Domaine — accès livraisons", categorySlugs: ["traiteur", "domaine-reception", "dj", "fleuriste"] },
      { title: "Accueil des enfants à l'espace dédié", start: "14:30", end: "15:00", location: "La grange", categorySlugs: ["garde-enfants-evenementielle"], description: "Pointage à l'arrivée, remise des consignes des parents." },
      { title: "Cérémonie laïque", start: "15:00", end: "16:00", location: "Le parc", categorySlugs: ["photographe", "dj"] },
      { title: "Goûter des enfants", start: "16:30", end: "17:15", location: "La grange", categorySlugs: ["garde-enfants-evenementielle", "traiteur"] },
      { title: "Cocktail", start: "17:00", end: "19:30", location: "Terrasse", categorySlugs: ["traiteur", "photographe", "dj"] },
      { title: "Dîner", start: "20:00", end: "22:00", location: "Orangerie", categorySlugs: ["traiteur", "photographe"] },
      { title: "Coucher des petits (espace sieste)", start: "21:30", location: "La grange — coin calme", categorySlugs: ["garde-enfants-evenementielle"] },
      { title: "Ouverture de bal", start: "22:30", end: "23:00", location: "Orangerie", categorySlugs: ["dj", "photographe"] },
    ],
    budget: [
      { category: "Lieu", label: "Location du domaine", plannedCents: 900_000, providerIndex: 1, expenses: [{ label: "Acompte domaine (30 %)", amountCents: 255_000, status: "paid", paidAt: "2026-09-15" }, { label: "Solde domaine", amountCents: 595_000, status: "committed" }] },
      { category: "Traiteur", label: "Cocktail + dîner 120 couverts", plannedCents: 1_200_000, providerIndex: 2, expenses: [{ label: "Acompte traiteur", amountCents: 375_000, status: "paid", paidAt: "2026-10-02" }] },
      { category: "Enfants", label: "Garde d'enfants (2 encadrantes)", plannedCents: 100_000, providerIndex: 0, expenses: [{ label: "Acompte garde d'enfants", amountCents: 30_000, status: "paid", paidAt: "2026-10-10" }] },
      { category: "Photo & vidéo", label: "Reportage photo", plannedCents: 250_000, providerIndex: 3, expenses: [{ label: "Acompte photographe", amountCents: 72_000, status: "committed" }] },
      { category: "Musique", label: "DJ + sonorisation", plannedCents: 180_000, providerIndex: 4 },
      { category: "Organisation", label: "Wedding planner", plannedCents: 320_000, providerIndex: 5, expenses: [{ label: "Honoraires wedding planner (1/3)", amountCents: 106_700, status: "paid", paidAt: "2026-08-01" }] },
      { category: "Décoration", label: "Fleurs et décoration", plannedCents: 220_000, providerIndex: 6, expenses: [{ label: "Devis fleuriste (estimation)", amountCents: 240_000, status: "committed" }] },
      { category: "Divers", label: "Tenues, alliances, papeterie", plannedCents: 330_000, expenses: [{ label: "Faire-part", amountCents: 42_000, status: "paid", paidAt: "2026-07-20" }] },
    ],
    doneTasks: ["Choisir et réserver le lieu de réception", "Réserver le lieu de cérémonie", "Réserver le traiteur", "Réserver le photographe et le vidéaste", "Fixer le budget global et sa répartition", "Estimer le nombre et l'âge des enfants présents", "Réserver une garde d'enfants ou une animation", "Établir la liste des invités"],
    channels: [
      {
        name: "Logistique lieu & traiteur",
        description: "Accès, horaires de livraison, cuisine, plan de salle.",
        kind: "coordination",
        memberKeys: ["helene", "julien", "camille", "louis"],
        messages: [
          { from: "camille", body: "Bonjour à tous ! Canal dédié à la logistique entre le domaine et le traiteur. @Hélène peux-tu confirmer l'heure d'ouverture de l'accès livraisons ?", minutesAgo: 5_000 },
          { from: "helene", body: "Bonjour ! Le portail livraisons est ouvert dès 9h le samedi. La cuisine traiteur est équipée (2 fours, chambre froide 600 L).", minutesAgo: 4_900 },
          { from: "julien", body: "Parfait, merci @Hélène. Nous arriverons vers 10h avec deux véhicules. Combien de prises 32A dans la cuisine ?", minutesAgo: 4_700 },
          { from: "helene", body: "Deux prises 32A + une 16A, toutes à côté du passe. Je vous envoie le plan de l'orangerie en pièce jointe dans la journée.", minutesAgo: 4_600 },
          { from: "louis", body: "Merci à vous deux. Pour le goûter des enfants à 16h30, @Julien tu peux prévoir une version sans fruits à coque ? Marie a quelques consignes des parents.", minutesAgo: 3_000 },
          { from: "julien", body: "Oui bien sûr : madeleines, fruits frais, jus. Je note « sans fruits à coque » pour tout le goûter.", minutesAgo: 2_950 },
          { from: "camille", body: "Je mets à jour le planning avec ces horaires. Vérifiez vos notifications !", minutesAgo: 2_800 },
        ],
      },
      {
        name: "Espace enfants",
        description: "Coordination de la garde : effectifs, activités, consignes.",
        kind: "coordination",
        memberKeys: ["marie", "nora", "camille", "louis"],
        messages: [
          { from: "marie", body: "Bonjour ! Nous serons deux sur place avec @Nora. Pour 14 enfants de 2 à 11 ans c'est confortable. Louis, les inscriptions des parents sont bien ouvertes ?", minutesAgo: 6_000 },
          { from: "louis", body: "Oui, 11 enfants déjà inscrits par leurs parents. Les 3 derniers d'ici fin du mois.", minutesAgo: 5_800 },
          { from: "nora", body: "Super. On prévoit un coin sieste séparé pour les 2 petits de moins de 3 ans ?", minutesAgo: 5_600 },
          { from: "camille", body: "Oui, Hélène nous laisse le fond de la grange avec deux lits parapluie. Je l'ajoute au brief logistique.", minutesAgo: 5_500 },
          { from: "marie", body: "Programme prévu : jeux calmes à l'arrivée, chasse au trésor dans le parc à 15h (pendant la cérémonie), goûter 16h30, atelier masques 18h, film + coucher des petits 21h30.", minutesAgo: 4_000 },
          { from: "louis", body: "C'est parfait. Les consignes de santé sont dans les fiches enfants, visibles uniquement par vous et Camille.", minutesAgo: 3_900 },
          { from: "marie", body: "Bien noté, nous ne consultons que ce qui est nécessaire pour les enfants qui nous sont confiés. 👍", minutesAgo: 3_850 },
        ],
      },
    ],
    generalMessages: [
      { from: "louis", body: "Bienvenue à toute l'équipe du mariage ! Ce canal est ouvert à tous les prestataires. Le planning du jour J est dans l'onglet Planning.", minutesAgo: 10_000 },
      { from: "camille", body: "Hello ! Je suis Camille, wedding planner. Je centralise les questions d'organisation : n'hésitez pas à me mentionner avec @Camille.", minutesAgo: 9_800 },
      { from: "ines", body: "Bonjour ! Inès, photographe. J'arriverai à 13h pour les préparatifs. @Camille peux-tu me dire où se préparent les mariés ?", minutesAgo: 8_000 },
      { from: "camille", body: "@Inès : Lisa dans la suite du domaine (1er étage), Louis dans le gîte à côté de la grange.", minutesAgo: 7_900 },
      { from: "theo", body: "Salut tout le monde, Théo (DJ). Je confirme ma dispo. @Louis je t'envoie le brief musical à remplir cette semaine.", minutesAgo: 7_000 },
      { from: "lisa", body: "Merci à tous ! On est tellement contents de vous avoir avec nous. 💐", minutesAgo: 6_500 },
      { from: "helene", body: "Petit rappel : stationnement prestataires derrière la grange, l'allée principale reste libre pour les invités.", minutesAgo: 1_500 },
    ],
    grants: [{ userKey: "camille", permission: "children.view_sensitive", byUserKey: "louis" }],
  },
  {
    key: "baptemeChloe",
    ownerKey: "paul",
    name: "Baptême de Chloé",
    type: "baptism",
    eventDate: "2027-03-21",
    startTime: "11:00",
    endTime: "18:00",
    venueName: "Salle des fêtes de Caudéran",
    addressLine1: "Rue de la Mairie",
    postalCode: "33200",
    city: "Bordeaux",
    department: "33",
    expectedGuests: 45,
    expectedChildren: 9,
    budgetCents: 450_000,
    description: "Cérémonie à 11h puis déjeuner et après-midi en famille.",
    preferences: "Animation douce pour les enfants l'après-midi.",
    members: [
      { userKey: "paul", role: "owner" },
      { userKey: "sofia", role: "provider", categorySlug: "animation-enfants", proKey: "sofia" },
    ],
    providers: [
      { proKey: "sofia", categorySlug: "animation-enfants", status: "confirmed", quoteCents: 38_000, memberUserKey: "sofia", serviceStart: "14:00", serviceEnd: "17:30" },
      { externalName: "Traiteur Les Quais", externalEmail: "contact@lesquais.test", categorySlug: "traiteur", status: "quoted", quoteCents: 160_000 },
    ],
    milestones: [
      { title: "Cérémonie", start: "11:00", end: "12:00", location: "Église Saint-Amand", categorySlugs: [] },
      { title: "Déjeuner", start: "12:45", end: "15:00", location: "Salle des fêtes", categorySlugs: ["traiteur"] },
      { title: "Animation enfants", start: "14:00", end: "17:30", location: "Salle annexe", categorySlugs: ["animation-enfants"] },
    ],
    budget: [
      { category: "Lieu", label: "Salle des fêtes", plannedCents: 60_000, expenses: [{ label: "Location salle", amountCents: 60_000, status: "paid", paidAt: "2026-10-01" }] },
      { category: "Traiteur", label: "Déjeuner 45 couverts", plannedCents: 180_000, providerIndex: 1 },
      { category: "Enfants", label: "Animation", plannedCents: 40_000, providerIndex: 0, expenses: [{ label: "Acompte animation", amountCents: 11_400, status: "paid", paidAt: "2026-10-12" }] },
    ],
    doneTasks: ["Fixer la date avec la paroisse ou la mairie", "Réserver la salle ou le restaurant"],
    channels: [],
    generalMessages: [
      { from: "paul", body: "Bienvenue Sofia ! Hâte de voir le programme pour les 9 enfants.", minutesAgo: 3_000 },
      { from: "sofia", body: "Merci Paul ! Je prévois maquillage, bulles géantes et un petit spectacle à 16h.", minutesAgo: 2_900 },
    ],
  },
  {
    key: "seminaireDiginumia",
    ownerKey: "paul",
    name: "Séminaire DIGINUMIA",
    type: "seminar",
    eventDate: "2027-01-28",
    startTime: "09:00",
    endTime: "22:00",
    venueName: "Espace Compans",
    addressLine1: "Place Compans",
    postalCode: "31000",
    city: "Toulouse",
    department: "31",
    expectedGuests: 30,
    expectedChildren: 0,
    budgetCents: 900_000,
    description: "Séminaire annuel : ateliers le matin, cohésion l'après-midi, dîner.",
    preferences: "Format participatif, pas de PowerPoint interminable.",
    members: [{ userKey: "paul", role: "owner" }],
    providers: [
      { externalName: "Compans Événements", externalEmail: "resa@compans.test", categorySlug: "salle-evenementielle", status: "confirmed", quoteCents: 250_000 },
      { categorySlug: "traiteur", status: "shortlisted" },
      { categorySlug: "animateur", status: "shortlisted" },
    ],
    milestones: [
      { title: "Accueil café", start: "09:00", end: "09:30", categorySlugs: ["traiteur"] },
      { title: "Ateliers", start: "09:30", end: "12:30", categorySlugs: [] },
      { title: "Déjeuner", start: "12:30", end: "14:00", categorySlugs: ["traiteur"] },
      { title: "Activité de cohésion", start: "14:30", end: "17:30", categorySlugs: ["animateur"] },
    ],
    budget: [
      { category: "Lieu", label: "Salles + plénière", plannedCents: 250_000, providerIndex: 0, expenses: [{ label: "Réservation salle", amountCents: 250_000, status: "committed" }] },
      { category: "Traiteur", label: "Pauses, déjeuner, dîner", plannedCents: 400_000 },
      { category: "Animation", label: "Team building", plannedCents: 150_000 },
    ],
    doneTasks: ["Réserver le lieu et les salles de travail"],
    channels: [],
    generalMessages: [{ from: "paul", body: "Espace de coordination du séminaire 2027. Prestataires à venir.", minutesAgo: 1_000 }],
  },
];

export async function seed(ctx: SeedContext): Promise<void> {
  const { db, now } = ctx;
  const tz = "Europe/Paris";
  for (const spec of SPECS) {
    const ownerId = ctx.users[spec.ownerKey];
    if (!ownerId) throw new Error(`seed events: unknown owner ${spec.ownerKey}`);

    const [existing] = await db.select({ id: events.id }).from(events).where(and(eq(events.ownerUserId, ownerId), eq(events.name, spec.name), eq(events.isDemo, true))).limit(1);
    const startsAt = zonedDateTimeToUtc(spec.eventDate, spec.startTime, tz);
    const endsAt = zonedDateTimeToUtc(spec.eventDate, spec.endTime, tz);
    let eventId: string;
    if (existing) {
      // Another seed (or a previous run) created the shell: keep it, fill what is missing below.
      eventId = existing.id;
      await db
        .update(events)
        .set({ type: spec.type, description: spec.description, eventDate: spec.eventDate, startsAt, endsAt, timezone: tz, expectedGuests: spec.expectedGuests, expectedChildren: spec.expectedChildren, budgetCents: spec.budgetCents, preferences: spec.preferences, department: spec.department, postalCode: spec.postalCode })
        .where(eq(events.id, eventId));
    } else {
      const [event] = await db
        .insert(events)
        .values({
          ownerUserId: ownerId,
          name: spec.name,
          type: spec.type,
          description: spec.description,
          status: "planning",
          eventDate: spec.eventDate,
          startsAt,
          endsAt,
          timezone: tz,
          venueName: spec.venueName,
          addressLine1: spec.addressLine1,
          postalCode: spec.postalCode,
          city: spec.city,
          department: spec.department,
          expectedGuests: spec.expectedGuests,
          expectedChildren: spec.expectedChildren,
          budgetCents: spec.budgetCents,
          preferences: spec.preferences,
          isDemo: true,
        })
        .returning({ id: events.id });
      if (!event) throw new Error("seed events: insert failed");
      eventId = event.id;
      await db.insert(auditLogs).values({ actorUserId: ownerId, action: "event.created", resourceType: "event", resourceId: eventId, eventId, metadata: { type: spec.type, demo: true } });
    }
    ctx.events[spec.key] = eventId;
    const has = async (table: typeof eventProfessionals | typeof eventTasks | typeof eventMilestones | typeof eventBudgetLines | typeof eventChannels) => (await db.select({ id: table.id }).from(table).where(eq(table.eventId, eventId)).limit(1)).length > 0;

    // Members (insert missing ones, refresh role/trade/listing of existing ones)
    const memberIdByUserKey = new Map<string, string>();
    for (const m of spec.members) {
      const userId = ctx.users[m.userKey];
      if (!userId) continue;
      const values = {
        role: m.role,
        status: "active" as const,
        categoryId: m.categorySlug ? (ctx.categories[m.categorySlug] ?? null) : null,
        professionalId: m.proKey ? (ctx.professionals[m.proKey] ?? null) : null,
        title: m.title ?? null,
      };
      const [row] = await db
        .insert(eventMembers)
        .values({ eventId, userId, ...values, invitedByUserId: m.role === "owner" ? null : ownerId, joinedAt: new Date(now.getTime() - 40 * 86_400_000) })
        .onConflictDoUpdate({ target: [eventMembers.eventId, eventMembers.userId], set: values })
        .returning({ id: eventMembers.id });
      if (row) {
        memberIdByUserKey.set(m.userKey, row.id);
        ctx.members[`${spec.key}:${m.userKey}`] = row.id;
      }
    }

    // Provider slots (a previous run without the professionals seed may have left external placeholders: link them now)
    const providerIds: string[] = [];
    for (const p of spec.providers) {
      if (!p.proKey || !ctx.professionals[p.proKey]) continue;
      await db
        .update(eventProfessionals)
        .set({ professionalId: ctx.professionals[p.proKey], externalName: null, memberId: p.memberUserKey ? (memberIdByUserKey.get(p.memberUserKey) ?? null) : null })
        .where(and(eq(eventProfessionals.eventId, eventId), eq(eventProfessionals.externalName, demoProName(p.proKey))));
    }
    if (!(await has(eventProfessionals))) for (const p of spec.providers) {
      const [row] = await db
        .insert(eventProfessionals)
        .values({
          eventId,
          professionalId: p.proKey ? (ctx.professionals[p.proKey] ?? null) : null,
          memberId: p.memberUserKey ? (memberIdByUserKey.get(p.memberUserKey) ?? null) : null,
          categoryId: ctx.categories[p.categorySlug] ?? null,
          externalName: p.proKey && ctx.professionals[p.proKey] ? null : (p.externalName ?? (p.proKey ? demoProName(p.proKey) : null)),
          externalEmail: p.externalEmail ?? null,
          externalPhone: p.externalPhone ?? null,
          status: p.status,
          quoteCents: p.quoteCents ?? null,
          serviceStartsAt: p.serviceStart ? zonedDateTimeToUtc(spec.eventDate, p.serviceStart, tz) : null,
          serviceEndsAt: p.serviceEnd ? rollover(zonedDateTimeToUtc(spec.eventDate, p.serviceEnd, tz), p.serviceStart ? zonedDateTimeToUtc(spec.eventDate, p.serviceStart, tz) : null) : null,
          notes: p.notes ?? null,
        })
        .returning({ id: eventProfessionals.id });
      if (row) providerIds.push(row.id);
    }

    // Checklist from templates, some done
    const templates = await db.select().from(checklistTemplates).where(and(eq(checklistTemplates.eventType, spec.type), eq(checklistTemplates.isActive, true)));
    const tasks = buildChecklist(templates, spec.eventDate);
    if (tasks.length && !(await has(eventTasks))) {
      await db.insert(eventTasks).values(
        tasks.map((t) => {
          const done = spec.doneTasks.includes(t.title);
          return { eventId, title: t.title, description: t.description, section: t.section, dueDate: t.dueDate, sortOrder: t.sortOrder, visibility: t.visibility, status: done ? ("done" as const) : ("todo" as const), completedAt: done ? new Date(now.getTime() - 10 * 86_400_000) : null, createdByUserId: ownerId, assigneeMemberId: t.section === "Enfants" ? (memberIdByUserKey.get("camille") ?? null) : null };
        }),
      );
    }

    // Milestones
    if (spec.milestones.length && !(await has(eventMilestones))) {
      await db.insert(eventMilestones).values(
        spec.milestones.map((m, i) => {
          const s = zonedDateTimeToUtc(spec.eventDate, m.start, tz);
          const e = m.end ? rollover(zonedDateTimeToUtc(spec.eventDate, m.end, tz), s) : null;
          return { eventId, title: m.title, description: m.description ?? null, startsAt: s, endsAt: e, location: m.location ?? null, categorySlugs: m.categorySlugs, sortOrder: i };
        }),
      );
    }

    // Budget
    if (!(await has(eventBudgetLines))) for (const [i, b] of spec.budget.entries()) {
      const [line] = await db
        .insert(eventBudgetLines)
        .values({ eventId, category: b.category, label: b.label, plannedCents: b.plannedCents, eventProfessionalId: b.providerIndex !== undefined ? (providerIds[b.providerIndex] ?? null) : null, sortOrder: i })
        .returning({ id: eventBudgetLines.id });
      if (line && b.expenses?.length) {
        await db.insert(eventExpenses).values(b.expenses.map((e) => ({ eventId, budgetLineId: line.id, label: e.label, amountCents: e.amountCents, status: e.status, paidAt: e.paidAt ?? null })));
      }
    }

    // Channels + messages
    if (!(await has(eventChannels))) {
      const [general] = await db.insert(eventChannels).values({ eventId, kind: "general", name: "Général", description: "Canal ouvert à toute l'équipe de l'évènement.", isOpenToAllMembers: true, createdByUserId: ownerId }).returning({ id: eventChannels.id });
      if (general) {
        await db.insert(channelMembers).values([...memberIdByUserKey.values()].map((memberId) => ({ channelId: general.id, memberId, lastReadAt: new Date(now.getTime() - 2 * 86_400_000) }))).onConflictDoNothing();
        await insertMessages(ctx, eventId, general.id, spec.generalMessages);
      }
      for (const c of spec.channels) {
        const [ch] = await db.insert(eventChannels).values({ eventId, kind: c.kind, name: c.name, description: c.description, isOpenToAllMembers: false, createdByUserId: ownerId }).returning({ id: eventChannels.id });
        if (!ch) continue;
        const memberIds = c.memberKeys.map((k) => memberIdByUserKey.get(k)).filter((x): x is string => Boolean(x));
        if (memberIds.length) await db.insert(channelMembers).values(memberIds.map((memberId) => ({ channelId: ch.id, memberId, lastReadAt: new Date(now.getTime() - 3 * 86_400_000) }))).onConflictDoNothing();
        await insertMessages(ctx, eventId, ch.id, c.messages);
      }
    }

    // Explicit grants (e.g. wedding planner may read health data)
    for (const g of spec.grants ?? []) {
      const memberId = memberIdByUserKey.get(g.userKey);
      const by = ctx.users[g.byUserKey];
      if (!memberId || !by) continue;
      const inserted = await db.insert(eventPermissions).values({ eventId, memberId, permission: g.permission, effect: "allow", grantedByUserId: by }).onConflictDoNothing().returning({ id: eventPermissions.id });
      if (inserted.length) await db.insert(auditLogs).values({ actorUserId: by, action: "event.permission.set", resourceType: "event_member", resourceId: memberId, eventId, metadata: { permission: g.permission, effect: "allow" }, reason: "Coordination de l'espace enfants (démo)" });
    }

    // Owner's calendar entry for the day
    await db
      .insert(calendarEntries)
      .values({ ownerUserId: ownerId, eventId, kind: "event", title: spec.name, location: `${spec.venueName}, ${spec.city}`, startsAt, endsAt, allDay: false, timezone: tz, icalUid: `event-${eventId}@sousnosailes.fr` })
      .onConflictDoNothing();
  }
}

function rollover(end: Date, start: Date | null): Date {
  return start && end <= start ? new Date(end.getTime() + 86_400_000) : end;
}

/** Display name used for a provider slot when the professionals seed has not created the listing yet. */
function demoProName(proKey: string): string {
  const names: Record<string, string> = { marie: "Marie Delcourt — Garde d'enfants", camille: "Camille Ferrand — Wedding planner", julien: "Julien Rossi Traiteur", helene: "Domaine des Tilleuls", theo: "DJ Théo Lambert", ines: "Inès Garnier Photographe", sofia: "Sofia Martins Animation" };
  return names[proKey] ?? proKey;
}

async function insertMessages(ctx: SeedContext, eventId: string, channelId: string, list: Array<{ from: string; body: string; minutesAgo: number }>) {
  if (!list.length) return;
  const rows = list
    .map((m) => {
      const authorUserId = ctx.users[m.from];
      if (!authorUserId) return null;
      const mentions = Object.entries(ctx.users)
        .filter(([key]) => {
          const user = DEMO_FIRST_NAMES[key];
          return user ? m.body.includes(`@${user}`) : false;
        })
        .map(([, id]) => id);
      return { channelId, eventId, authorUserId, body: m.body, mentions, createdAt: new Date(ctx.now.getTime() - m.minutesAgo * 60_000) };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length) await ctx.db.insert(messages).values(rows);
}

const DEMO_FIRST_NAMES: Record<string, string> = { louis: "Louis", lisa: "Lisa", camille: "Camille", marie: "Marie", nora: "Nora", julien: "Julien", helene: "Hélène", theo: "Théo", ines: "Inès", paul: "Paul", sofia: "Sofia" };
