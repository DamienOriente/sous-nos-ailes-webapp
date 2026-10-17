// Reproducible, non-destructive demo seed.
// - Baseline (settings, options, editable texts) runs in every environment and only creates missing rows.
// - Demo data (accounts, venues, events…) runs only when DEMO_MODE is true and never overwrites
//   records that already exist (re-running is safe; use `pnpm db:reset` to start from scratch).
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth/password";
import { getDatabaseUrl, getEnv } from "../src/lib/env";
import { CONTENT_DEFAULTS } from "../src/server/content-defaults";
import { computeEventInstants, addDaysToDateOnly, parseDateOnly, zonedDateTimeToUtc } from "../src/lib/time";
import { computePricing, type PricingSettings } from "../src/domain/pricing";
import { buildChecklist } from "../src/domain/checklist";
import { EVENT_TYPE_LABELS } from "../src/domain/labels";
import type { EventStatus, EventType, TriState } from "../src/generated/prisma/enums";

const env = getEnv();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseUrl() }) });

export const DEMO_PASSWORDS = {
  admin: "demo-marie-2026",
  client: "demo-client-2026",
  provider: "demo-intervenant-2026",
  partner: "demo-partenaire-2026",
} as const;

function todayParis(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts; // YYYY-MM-DD
}

async function seedBaseline() {
  await prisma.businessSettings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
  const options = [
    { code: "atelier-creatif", label: "Atelier créatif encadré", description: "Matériel fourni, activité adaptée aux âges présents.", priceCents: 6_000, pricingUnit: "FLAT" as const, sortOrder: 1 },
    { code: "coin-calme", label: "Coin calme et repos pour les plus petits", description: "Tapis, coussins, veilleuse ; installation avant l’arrivée des enfants.", priceCents: 3_500, pricingUnit: "FLAT" as const, sortOrder: 2 },
    { code: "veillee", label: "Veillée pyjama (lecture, musique douce)", description: "Pour les fins de soirée ; par intervenant·e mobilisé·e.", priceCents: 2_000, pricingUnit: "PER_PROVIDER" as const, sortOrder: 3 },
    { code: "jeux-exterieurs", label: "Grands jeux extérieurs", description: "Selon l’espace disponible et la météo.", priceCents: 4_000, pricingUnit: "FLAT" as const, sortOrder: 4 },
  ];
  for (const option of options) {
    const exists = await prisma.serviceOption.findUnique({ where: { code: option.code } });
    if (!exists) await prisma.serviceOption.create({ data: option });
  }
  for (const [key, block] of Object.entries(CONTENT_DEFAULTS)) {
    const exists = await prisma.contentBlock.findUnique({ where: { key } });
    if (!exists) await prisma.contentBlock.create({ data: { key, title: block.title, body: block.body } });
  }
}

async function ensureUser(input: { email: string; name: string; phone?: string; role: "ADMIN" | "CLIENT" | "PROVIDER" | "PARTNER"; password: string }) {
  const passwordHash = await hashPassword(input.password);
  return prisma.user.upsert({
    where: { email: input.email },
    create: { email: input.email, name: input.name, phone: input.phone ?? null, role: input.role, passwordHash, isDemo: true },
    update: { passwordHash, isDemo: true, isActive: true },
  });
}

type SeedEvent = {
  key: string;
  reference: string;
  clientEmail: string;
  eventType: EventType;
  status: EventStatus;
  daysFromNow: number;
  flexible?: boolean;
  dateNote?: string;
  startTime: string;
  endTime: string;
  venueSlug?: string;
  venueName?: string;
  city: string;
  postalCode: string;
  headcount: { childrenUnder3: number; children3to5: number; children6to10: number; children11plus: number };
  parentsOnSite: TriState;
  dedicatedSpace: TriState;
  optionCodes: string[];
  requiredProviders: number;
  message?: string;
  referral?: { venueSlug: string; sourceKind: "LINK" | "QR" | "VENUE_PAGE" };
  prep?: { spaceDescription?: string; meetingPoint?: string; onSiteContactName?: string; onSiteContactPhone?: string; scheduleNotes?: string; opsValidated?: boolean };
  quotes?: Array<{ status: "SUPERSEDED" | "SENT" | "ACCEPTED"; travelFeeCents?: number; discountPercent?: number; acceptedByClient?: boolean }>;
  invitations?: Array<{ providerEmail: string; status: "PENDING" | "ACCEPTED" | "DECLINED"; note?: string }>;
  assignments?: Array<{ providerEmail: string; roleLabel?: string }>;
  checklistDone?: number;
  notes?: string[];
  declinedReason?: string;
};

async function seedDemo() {
  const today = todayParis();
  const d = (days: number) => addDaysToDateOnly(today, days);

  const marie = await ensureUser({ email: "marie@example.test", name: "Marie", phone: "06 00 00 00 01", role: "ADMIN", password: DEMO_PASSWORDS.admin });
  await ensureUser({ email: "camille.durand@example.test", name: "Camille Durand", phone: "06 00 00 00 11", role: "CLIENT", password: DEMO_PASSWORDS.client });
  await ensureUser({ email: "thomas.lefevre@example.test", name: "Thomas Lefèvre", phone: "06 00 00 00 12", role: "CLIENT", password: DEMO_PASSWORDS.client });

  const providers = [
    { email: "alix.moreau@example.test", name: "Alix Moreau", displayName: "Alix", city: "Lyon", sector: "Lyon et métropole", bio: "Auxiliaire de puériculture en crèche, habituée aux groupes d’enfants de 2 à 8 ans. Aime les ateliers manuels et les histoires.", skills: ["atelier-creatif", "coin-calme", "lecture"], vetting: "ACTIVE" as const, cost: 18_000, qualifications: [{ label: "Diplôme d’auxiliaire de puériculture (déclaré)", status: "VERIFIED" as const }, { label: "PSC1 (déclaré)", status: "VERIFIED" as const }] },
    { email: "berenice.petit@example.test", name: "Bérénice Petit", displayName: "Bérénice", city: "Villefranche-sur-Saône", sector: "Beaujolais et nord de Lyon", bio: "Animatrice périscolaire, grands jeux et musique.", skills: ["jeux-exterieurs", "musique"], vetting: "ACTIVE" as const, cost: 16_000, qualifications: [{ label: "BAFA (déclaré)", status: "VERIFIED" as const }] },
    { email: "chloe.garnier@example.test", name: "Chloé Garnier", displayName: "Chloé", city: "Bourgoin-Jallieu", sector: "Nord-Isère et est lyonnais", bio: "Étudiante en éducation de jeunes enfants, disponible les week-ends.", skills: ["atelier-creatif", "veillee"], vetting: "IN_REVIEW" as const, cost: 15_000, qualifications: [{ label: "Formation EJE en cours (déclarée)", status: "DECLARED" as const }] },
    { email: "dorian.robin@example.test", name: "Dorian Robin", displayName: "Dorian", city: "Lyon", sector: "Lyon et métropole", bio: "Éducateur de jeunes enfants, référent sur les prestations longues.", skills: ["coin-calme", "veillee", "jeux-exterieurs"], vetting: "ACTIVE" as const, cost: 20_000, qualifications: [{ label: "Diplôme d’État d’éducateur de jeunes enfants (déclaré)", status: "VERIFIED" as const }] },
    { email: "elsa.nguyen@example.test", name: "Elsa Nguyen", displayName: "Elsa", city: "Mâcon", sector: "Mâconnais et Beaujolais", bio: "Assistante maternelle agréée (déclaré), douce avec les tout-petits.", skills: ["coin-calme"], vetting: "NEW" as const, cost: 15_000, qualifications: [{ label: "Agrément assistante maternelle (déclaré, non vérifié)", status: "DECLARED" as const }] },
  ];
  const providerByEmail = new Map<string, string>();
  for (const p of providers) {
    const user = await ensureUser({ email: p.email, name: p.name, role: "PROVIDER", password: DEMO_PASSWORDS.provider });
    let profile = await prisma.providerProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      profile = await prisma.providerProfile.create({
        data: { userId: user.id, displayName: p.displayName, city: p.city, sector: p.sector, bio: p.bio, skills: p.skills, vettingStatus: p.vetting, vettedAt: p.vetting === "ACTIVE" ? new Date() : null, costBasis: "PER_MISSION", agreedCostCents: p.cost, costNote: "Montant de démonstration, à convenir réellement." },
      });
      for (const q of p.qualifications) {
        await prisma.providerQualification.create({ data: { providerId: profile.id, label: q.label, status: q.status, verifiedAt: q.status === "VERIFIED" ? new Date() : null, verifiedNote: q.status === "VERIFIED" ? "Document vu par Marie (démonstration)." : null } });
      }
    }
    providerByEmail.set(p.email, profile.id);
  }

  const venues = [
    {
      slug: "domaine-des-tilleuls", name: "Domaine des Tilleuls", type: "DOMAINE" as const, city: "Clairval-en-Beaujolais", postalCode: "69999", region: "Beaujolais", illustrationKey: "domaine",
      summary: "Domaine viticole fictif aux salles voûtées et au grand parc clos, où les enfants disposent d’un salon en retrait de la salle de réception.",
      description: "Le Domaine des Tilleuls est un lieu de démonstration entièrement fictif. Il illustre ce qu’une page partenaire documentée apporte aux organisateurs : la configuration des espaces, ce qui facilite l’accueil des enfants, et ce qu’il faut anticiper.\n\nLa salle de réception ouvre sur une terrasse puis sur un parc clos de murs, ce qui permet des jeux extérieurs encadrés jusqu’à la tombée de la nuit. Un salon attenant, chauffé et à l’écart de la sono, sert d’espace enfants : il accueille confortablement une quinzaine d’enfants avec un coin calme pour les plus petits.\n\nL’accès se fait par un chemin en gravier ; l’équipe arrive par l’entrée de service pour installer le matériel sans croiser les invités.",
      childrenSpaces: "Salon attenant (environ 45 m²), chauffé, porte vers la terrasse. Sanitaires à proximité. Possibilité d’obscurcir la pièce pour le coin repos.",
      constraints: "Pièce d’eau non clôturée dans le parc : surveillance renforcée à l’extérieur. Sono puissante dans la salle principale.",
      accessInfo: "Entrée de service par le portail nord ; stationnement de l’équipe derrière le chai. Code du portail communiqué par le régisseur le jour J.",
      contactName: "Régisseur du domaine (fictif)", contactEmail: "regie@domaine-des-tilleuls.example.test", contactPhone: "04 00 00 00 21",
      partnershipStatus: "ACTIVE" as const, editorialStatus: "PUBLISHED" as const, referralCode: "tilleuls",
      partnerEmail: "contact@domaine-des-tilleuls.example.test",
    },
    {
      slug: "chateau-de-montvallon", name: "Château de Montvallon", type: "CHATEAU" as const, city: "Montvallon-sur-Saône", postalCode: "71999", region: "Mâconnais", illustrationKey: "chateau",
      summary: "Château de démonstration : orangerie pour les enfants, grand escalier à sécuriser, parc en terrasses.",
      description: "Le Château de Montvallon est un lieu fictif conçu pour la démonstration. Sa particularité pour l’accueil des enfants est l’orangerie, un bâtiment indépendant de plain-pied situé à cinquante mètres de la salle du dîner.\n\nL’orangerie, lumineuse et vaste, accueille sans difficulté les ateliers et les grands jeux lorsqu’il pleut ; par beau temps, la pelouse basse du parc, plane et sans pièce d’eau, est idéale. Les terrasses supérieures comportent en revanche des escaliers en pierre sans main courante.\n\nLe lieu est habitué aux mariages avec de nombreux enfants et prévoit un point d’eau et des sanitaires à proximité immédiate de l’orangerie.",
      childrenSpaces: "Orangerie indépendante de plain-pied (environ 80 m²), sanitaires attenants, accès direct à la pelouse basse.",
      constraints: "Escaliers en pierre sur les terrasses supérieures : zone à délimiter. Pas de chauffage dans l’orangerie avant mai.",
      accessInfo: "Parking visiteurs puis allée de gauche vers l’orangerie. Le gardien ouvre la grille latérale pour le matériel.",
      contactName: "Responsable événements (fictif)", contactEmail: "events@chateau-de-montvallon.example.test", contactPhone: "03 00 00 00 31",
      partnershipStatus: "ACTIVE" as const, editorialStatus: "PUBLISHED" as const, referralCode: "montvallon",
    },
    {
      slug: "orangerie-de-belmont", name: "L’Orangerie de Belmont", type: "SALLE_DE_RECEPTION" as const, city: "Belmont-les-Vignes", postalCode: "69998", region: "Monts du Lyonnais", illustrationKey: "orangerie",
      summary: "Salle de réception fictive, une seule grande pièce modulable : l’espace enfants se crée avec des paravents et un éclairage dédié.",
      description: "L’Orangerie de Belmont est une salle de démonstration fictive. Contrairement aux deux autres lieux d’exemple, elle ne dispose pas de pièce séparée pour les enfants : tout se joue dans l’aménagement.\n\nLa salle unique, haute de plafond, se partitionne avec des paravents et des tapis ; l’équipe installe un coin lecture près des grandes fenêtres et un espace de jeux calmes à l’opposé de la piste de danse. Une petite cour fermée permet de sortir par petits groupes.\n\nCe type de lieu demande une préparation plus fine des horaires : les enfants fatigués n’ont pas de pièce sombre pour se reposer, d’où l’intérêt de prévoir un retour des familles raisonnablement tôt ou un coin repos aménagé.",
      childrenSpaces: "Zone délimitée par paravents dans la salle principale (environ 30 m²). Petite cour fermée. Pas de pièce isolée.",
      constraints: "Pas d’espace séparé ni obscur : coin repos difficile après 23 h. Niveau sonore élevé après l’ouverture du bal.",
      accessInfo: "Livraison du matériel par la cour ; stationnement rue adjacente.",
      contactName: "Gérante (fictif)", contactEmail: "bonjour@orangerie-belmont.example.test", contactPhone: "04 00 00 00 41",
      partnershipStatus: "PROSPECT" as const, editorialStatus: "REVIEW" as const, referralCode: "belmont",
    },
  ];
  const venueBySlug = new Map<string, string>();
  for (const v of venues) {
    const { partnerEmail, ...data } = v;
    let venue = await prisma.partnerVenue.findUnique({ where: { slug: v.slug } });
    if (!venue) {
      venue = await prisma.partnerVenue.create({ data: { ...data, isDemo: true, publishedAt: v.editorialStatus === "PUBLISHED" ? new Date() : null, lastVerifiedAt: new Date() } });
    }
    if (partnerEmail && !venue.partnerUserId) {
      const partner = await ensureUser({ email: partnerEmail, name: "Domaine des Tilleuls (compte partenaire fictif)", role: "PARTNER", password: DEMO_PASSWORDS.partner });
      await prisma.partnerVenue.update({ where: { id: venue.id }, data: { partnerUserId: partner.id } });
    }
    venueBySlug.set(v.slug, venue.id);
    if ((await prisma.internalNote.count({ where: { venueId: venue.id } })) === 0 && v.slug === "domaine-des-tilleuls") {
      await prisma.internalNote.create({ data: { venueId: venue.id, authorId: marie.id, body: "Mémoire du lieu (démo) : prévoir une rallonge pour le salon enfants, la prise la plus proche est derrière le bar. Le régisseur préfère que l’équipe arrive 45 min avant les invités." } });
    }
  }

  const settings = await prisma.businessSettings.findUniqueOrThrow({ where: { id: "default" } });
  const pricing: PricingSettings = {
    hourlyRateCents: settings.hourlyRateCents, minimumHours: settings.minimumHours, minimumAmountCents: settings.minimumAmountCents,
    nightSurchargeStartHour: settings.nightSurchargeStartHour, nightSurchargePercent: settings.nightSurchargePercent, sundaySurchargePercent: settings.sundaySurchargePercent,
    vatMode: settings.vatMode, vatRateBps: settings.vatRateBps,
  };
  const options = await prisma.serviceOption.findMany();

  const events: SeedEvent[] = [
    {
      key: "E1", reference: "LPI-DEMO-0001", clientEmail: "camille.durand@example.test", eventType: "WEDDING", status: "NEW", daysFromNow: 70,
      startTime: "17:00", endTime: "23:30", venueSlug: "domaine-des-tilleuls", city: "Clairval-en-Beaujolais", postalCode: "69999",
      headcount: { childrenUnder3: 1, children3to5: 4, children6to10: 6, children11plus: 2 }, parentsOnSite: "YES", dedicatedSpace: "YES", optionCodes: ["atelier-creatif", "coin-calme"], requiredProviders: 2,
      message: "Nous aimerions que les enfants puissent dîner de leur côté puis rejoindre la soirée pour l’ouverture du bal.",
      referral: { venueSlug: "domaine-des-tilleuls", sourceKind: "LINK" },
    },
    {
      key: "E2", reference: "LPI-DEMO-0002", clientEmail: "thomas.lefevre@example.test", eventType: "WEDDING", status: "PROPOSAL_SENT", daysFromNow: 45,
      startTime: "18:00", endTime: "01:30", venueName: "Salle des fêtes de la commune (lieu libre)", city: "Saint-Aubin-des-Prés", postalCode: "38999",
      headcount: { childrenUnder3: 0, children3to5: 5, children6to10: 7, children11plus: 0 }, parentsOnSite: "PARTIAL", dedicatedSpace: "UNKNOWN", optionCodes: ["veillee"], requiredProviders: 2,
      message: "Mariage en soirée, fin tardive. Nous pouvons prévoir une petite salle annexe.",
      quotes: [{ status: "SUPERSEDED", travelFeeCents: 6_000 }, { status: "SENT", travelFeeCents: 4_500, discountPercent: 5 }],
      notes: ["Première version envoyée avec un déplacement surestimé ; révisée après échange téléphonique (démo)."],
    },
    {
      key: "E3", reference: "LPI-DEMO-0003", clientEmail: "camille.durand@example.test", eventType: "PRIVATE_PARTY", status: "PREPARING", daysFromNow: 30,
      startTime: "15:00", endTime: "21:00", venueSlug: "chateau-de-montvallon", city: "Montvallon-sur-Saône", postalCode: "71999",
      headcount: { childrenUnder3: 0, children3to5: 6, children6to10: 8, children11plus: 1 }, parentsOnSite: "YES", dedicatedSpace: "YES", optionCodes: ["jeux-exterieurs", "atelier-creatif"], requiredProviders: 2,
      message: "Anniversaire de famille, beaucoup de cousins.",
      prep: { spaceDescription: "Orangerie réservée aux enfants, accès à la pelouse basse.", meetingPoint: "Grille latérale du château, 14 h 15", onSiteContactName: "Camille Durand", onSiteContactPhone: "06 00 00 00 11" },
      quotes: [{ status: "ACCEPTED", travelFeeCents: 5_000, acceptedByClient: true }],
      invitations: [
        { providerEmail: "alix.moreau@example.test", status: "ACCEPTED" },
        { providerEmail: "berenice.petit@example.test", status: "DECLINED", note: "Indisponible ce jour-là, désolée." },
        { providerEmail: "chloe.garnier@example.test", status: "PENDING" },
      ],
      assignments: [{ providerEmail: "alix.moreau@example.test", roleLabel: "Référente" }],
      checklistDone: 3,
      notes: ["Équipe incomplète : relancer Chloé ou proposer à Dorian (démo)."],
    },
    {
      key: "E4", reference: "LPI-DEMO-0004", clientEmail: "thomas.lefevre@example.test", eventType: "PROFESSIONAL", status: "CONFIRMED", daysFromNow: 20,
      startTime: "10:00", endTime: "16:00", venueSlug: "orangerie-de-belmont", city: "Belmont-les-Vignes", postalCode: "69998",
      headcount: { childrenUnder3: 0, children3to5: 3, children6to10: 5, children11plus: 2 }, parentsOnSite: "YES", dedicatedSpace: "PARTIAL", optionCodes: ["atelier-creatif"], requiredProviders: 2,
      message: "Journée d’entreprise avec familles invitées.",
      prep: { spaceDescription: "Zone paravents près des fenêtres + cour fermée.", meetingPoint: "Cour arrière, 9 h 15", onSiteContactName: "Thomas Lefèvre", onSiteContactPhone: "06 00 00 00 12", scheduleNotes: "Déjeuner des enfants à 12 h 30 avec les familles.", opsValidated: true },
      quotes: [{ status: "ACCEPTED", travelFeeCents: 3_000, acceptedByClient: true }],
      invitations: [
        { providerEmail: "dorian.robin@example.test", status: "ACCEPTED" },
        { providerEmail: "elsa.nguyen@example.test", status: "ACCEPTED" },
      ],
      assignments: [{ providerEmail: "dorian.robin@example.test", roleLabel: "Référent" }, { providerEmail: "elsa.nguyen@example.test" }],
      checklistDone: 99,
    },
    {
      key: "E5", reference: "LPI-DEMO-0005", clientEmail: "camille.durand@example.test", eventType: "WEDDING", status: "COMPLETED", daysFromNow: -40,
      startTime: "16:00", endTime: "00:30", venueSlug: "domaine-des-tilleuls", city: "Clairval-en-Beaujolais", postalCode: "69999",
      headcount: { childrenUnder3: 0, children3to5: 4, children6to10: 4, children11plus: 0 }, parentsOnSite: "YES", dedicatedSpace: "YES", optionCodes: ["coin-calme"], requiredProviders: 1,
      prep: { spaceDescription: "Salon attenant.", meetingPoint: "Entrée de service", onSiteContactName: "Camille Durand", onSiteContactPhone: "06 00 00 00 11", opsValidated: true },
      quotes: [{ status: "ACCEPTED", travelFeeCents: 4_000, acceptedByClient: true }],
      invitations: [{ providerEmail: "alix.moreau@example.test", status: "ACCEPTED" }],
      assignments: [{ providerEmail: "alix.moreau@example.test", roleLabel: "Référente" }],
      checklistDone: 99,
    },
    {
      key: "E6", reference: "LPI-DEMO-0006", clientEmail: "thomas.lefevre@example.test", eventType: "WEDDING", status: "QUALIFYING", daysFromNow: 30,
      startTime: "17:30", endTime: "23:00", venueName: "Chez les parents de la mariée (lieu libre)", city: "Lyon", postalCode: "69003",
      headcount: { childrenUnder3: 0, children3to5: 3, children6to10: 3, children11plus: 0 }, parentsOnSite: "YES", dedicatedSpace: "NO", optionCodes: [], requiredProviders: 1,
      message: "Petit mariage, le même soir qu’une autre demande : sert à montrer la détection de conflit d’affectation (démo).",
      invitations: [{ providerEmail: "alix.moreau@example.test", status: "ACCEPTED" }],
      notes: ["Alix a accepté mais elle est déjà affectée au LPI-DEMO-0003 aux mêmes horaires : l’affectation sera bloquée (démo)."],
    },
    {
      key: "E7", reference: "LPI-DEMO-0007", clientEmail: "thomas.lefevre@example.test", eventType: "PRIVATE_PARTY", status: "DECLINED", daysFromNow: 15,
      startTime: "14:00", endTime: "18:00", venueName: "Appartement (lieu libre)", city: "Lyon", postalCode: "69006",
      headcount: { childrenUnder3: 4, children3to5: 0, children6to10: 0, children11plus: 0 }, parentsOnSite: "NO", dedicatedSpace: "NO", optionCodes: [], requiredProviders: 2,
      declinedReason: "Uniquement des enfants de moins de 3 ans sans parents sur place : hors du cadre étudié pour le moment.",
    },
    {
      key: "E8", reference: "LPI-DEMO-0008", clientEmail: "camille.durand@example.test", eventType: "WEDDING", status: "NEW", daysFromNow: 200, flexible: true, dateNote: "Été prochain, probablement un samedi de juin ou juillet.",
      startTime: "", endTime: "", venueName: "Lieu non encore choisi", city: "Annecy", postalCode: "74000",
      headcount: { childrenUnder3: 2, children3to5: 3, children6to10: 2, children11plus: 0 }, parentsOnSite: "YES", dedicatedSpace: "UNKNOWN", optionCodes: [], requiredProviders: 2,
      message: "La date n’est pas encore fixée, nous aimerions une idée de l’organisation possible.",
    },
  ];

  for (const spec of events) {
    const existing = await prisma.event.findUnique({ where: { reference: spec.reference } });
    if (existing) continue;
    const client = await prisma.user.findUniqueOrThrow({ where: { email: spec.clientEmail } });
    const date = d(spec.daysFromNow);
    const hasTimes = Boolean(spec.startTime && spec.endTime);
    const instants = hasTimes ? computeEventInstants({ date, startTime: spec.startTime, endTime: spec.endTime }) : null;
    const venueId = spec.venueSlug ? venueBySlug.get(spec.venueSlug) ?? null : null;
    const venueName = spec.venueSlug ? venues.find((v) => v.slug === spec.venueSlug)!.name : spec.venueName ?? null;
    const title = `${EVENT_TYPE_LABELS[spec.eventType]} — ${spec.city} — ${date.split("-").reverse().join("/")}`;
    const request = await prisma.eventRequest.create({
      data: {
        eventType: spec.eventType, eventDate: parseDateOnly(date), dateIsFlexible: Boolean(spec.flexible), dateNote: spec.dateNote ?? null,
        startTime: spec.startTime || null, endTime: spec.endTime || null, venueId, venueName, city: spec.city, postalCode: spec.postalCode,
        ...spec.headcount, parentsOnSite: spec.parentsOnSite, dedicatedSpace: spec.dedicatedSpace, optionCodes: spec.optionCodes,
        organizerName: client.name, organizerEmail: client.email, organizerPhone: client.phone, message: spec.message ?? null,
        privacyAcceptedAt: new Date(), source: spec.referral ? "PARTNER_LINK" : venueId ? "VENUE_PAGE" : "DIRECT", submissionKey: `seed-${spec.key}`,
      },
    });
    const event = await prisma.event.create({
      data: {
        reference: spec.reference, requestId: request.id, clientId: client.id, status: spec.status, title, eventType: spec.eventType,
        date: parseDateOnly(date), endDate: instants ? parseDateOnly(instants.endDateOnly) : null, dateIsFlexible: Boolean(spec.flexible), dateNote: spec.dateNote ?? null,
        startTime: spec.startTime || null, endTime: spec.endTime || null, startsAt: instants?.startsAt ?? null, endsAt: instants?.endsAt ?? null,
        venueId, venueName, city: spec.city, postalCode: spec.postalCode, ...spec.headcount, parentsOnSite: spec.parentsOnSite, dedicatedSpace: spec.dedicatedSpace,
        optionCodes: spec.optionCodes, requiredProviders: spec.requiredProviders,
        spaceDescription: spec.prep?.spaceDescription ?? null, meetingPoint: spec.prep?.meetingPoint ?? null, onSiteContactName: spec.prep?.onSiteContactName ?? null,
        onSiteContactPhone: spec.prep?.onSiteContactPhone ?? null, scheduleNotes: spec.prep?.scheduleNotes ?? null, opsValidatedAt: spec.prep?.opsValidated ? new Date() : null,
        declinedReason: spec.declinedReason ?? null, confirmedAt: spec.status === "CONFIRMED" || spec.status === "COMPLETED" ? new Date() : null, completedAt: spec.status === "COMPLETED" ? new Date() : null,
      },
    });
    if (spec.referral) {
      await prisma.referral.create({ data: { venueId: venueBySlug.get(spec.referral.venueSlug)!, requestId: request.id, sourceKind: spec.referral.sourceKind } });
    } else if (venueId) {
      await prisma.referral.create({ data: { venueId, requestId: request.id, sourceKind: "VENUE_PAGE" } });
    }
    // Checklist
    const items = buildChecklist({
      dateIsFlexible: Boolean(spec.flexible), hasDate: true, hasTimes, crossesMidnight: Boolean(instants?.crossesMidnight),
      durationMinutes: instants ? (instants.endsAt.getTime() - instants.startsAt.getTime()) / 60_000 : 0,
      dedicatedSpace: spec.dedicatedSpace, hasSpaceDescription: Boolean(spec.prep?.spaceDescription), hasMeetingPoint: Boolean(spec.prep?.meetingPoint),
      hasOnSiteContact: Boolean(spec.prep?.onSiteContactName && spec.prep?.onSiteContactPhone), parentsOnSite: spec.parentsOnSite, childrenUnder3: spec.headcount.childrenUnder3,
      hasPartnerVenue: Boolean(venueId), hasVenueMemory: spec.venueSlug === "domaine-des-tilleuls",
    });
    const doneCount = spec.checklistDone ?? 0;
    await prisma.checklistItem.createMany({ data: items.map((item, index) => ({ eventId: event.id, key: item.key, label: item.label, isAuto: true, isDone: index < doneCount, doneAt: index < doneCount ? new Date() : null, sortOrder: index })) });
    // Quotes
    if (spec.quotes?.length) {
      const quote = await prisma.quote.create({ data: { eventId: event.id } });
      let number = 0;
      for (const q of spec.quotes) {
        number += 1;
        const result = computePricing({
          durationMinutes: instants ? (instants.endsAt.getTime() - instants.startsAt.getTime()) / 60_000 : 240,
          providerCount: spec.requiredProviders, travelFeeCents: q.travelFeeCents ?? 0,
          options: options.filter((o) => spec.optionCodes.includes(o.code)).map((o) => ({ code: o.code, label: o.label, priceCents: o.priceCents, pricingUnit: o.pricingUnit })),
          nightMinutes: instants && spec.endTime < spec.startTime ? 90 : 0,
          discount: q.discountPercent ? { label: "Remise exceptionnelle", percent: q.discountPercent } : null,
          settings: pricing,
        });
        await prisma.quoteVersion.create({
          data: {
            quoteId: quote.id, number, status: q.status, title: `Proposition — ${title}`,
            introText: "Proposition de démonstration : les montants sont fictifs et servent uniquement à illustrer le fonctionnement.",
            vatMode: pricing.vatMode, vatRateBps: pricing.vatMode === "STANDARD" ? pricing.vatRateBps : 0,
            subtotalCents: result.subtotalCents, discountCents: result.discountCents, totalExclVatCents: result.totalExclVatCents, vatCents: result.vatCents, totalInclVatCents: result.totalInclVatCents,
            sentAt: new Date(Date.now() - (spec.quotes!.length - number + 1) * 3 * 24 * 60 * 60_000),
            acceptedAt: q.acceptedByClient ? new Date() : null, acceptedByUserId: q.acceptedByClient ? client.id : null,
            supersededAt: q.status === "SUPERSEDED" ? new Date() : null,
            lines: { create: result.lines.map((line, index) => ({ sortOrder: index, kind: line.kind, label: line.label, description: line.description ?? null, quantityHundredths: line.quantityHundredths, unitPriceCents: line.unitPriceCents, totalCents: line.totalCents })) },
          },
        });
      }
    }
    // Invitations & assignments
    for (const inv of spec.invitations ?? []) {
      const providerId = providerByEmail.get(inv.providerEmail)!;
      await prisma.missionInvitation.create({
        data: { eventId: event.id, providerId, status: inv.status, expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60_000), respondedAt: inv.status === "PENDING" ? null : new Date(), responseNote: inv.note ?? null, message: "Mission de démonstration." },
      });
    }
    for (const a of spec.assignments ?? []) {
      const providerId = providerByEmail.get(a.providerEmail)!;
      const invitation = await prisma.missionInvitation.findUnique({ where: { eventId_providerId: { eventId: event.id, providerId } } });
      const provider = await prisma.providerProfile.findUniqueOrThrow({ where: { id: providerId } });
      await prisma.assignment.create({ data: { eventId: event.id, providerId, invitationId: invitation?.id ?? null, roleLabel: a.roleLabel ?? null, agreedCostCents: provider.agreedCostCents } });
    }
    for (const note of spec.notes ?? []) {
      await prisma.internalNote.create({ data: { eventId: event.id, authorId: marie.id, body: note } });
    }
    await prisma.auditEvent.create({ data: { actorId: null, actorRole: "CLIENT", action: "request.submitted", entityType: "Event", entityId: event.id, summary: `Demande ${spec.reference} (données de démonstration)` } });
  }

  // Availabilities (only when none exist yet)
  const availabilitySpecs: Array<{ email: string; kind: "AVAILABLE" | "UNAVAILABLE"; from: [number, string]; to: [number, string]; note?: string }> = [
    { email: "alix.moreau@example.test", kind: "AVAILABLE", from: [1, "08:00"], to: [120, "23:59"] },
    { email: "berenice.petit@example.test", kind: "UNAVAILABLE", from: [29, "00:00"], to: [31, "23:59"], note: "Week-end en famille" },
    { email: "berenice.petit@example.test", kind: "AVAILABLE", from: [40, "08:00"], to: [90, "23:59"] },
    { email: "chloe.garnier@example.test", kind: "AVAILABLE", from: [30, "12:00"], to: [30, "20:00"], note: "Disponible l’après-midi seulement" },
    { email: "dorian.robin@example.test", kind: "AVAILABLE", from: [1, "08:00"], to: [60, "23:59"] },
    { email: "elsa.nguyen@example.test", kind: "AVAILABLE", from: [15, "08:00"], to: [25, "23:59"] },
    { email: "elsa.nguyen@example.test", kind: "UNAVAILABLE", from: [3, "00:00"], to: [10, "23:59"], note: "Congés" },
  ];
  for (const spec of availabilitySpecs) {
    const providerId = providerByEmail.get(spec.email)!;
    const count = await prisma.availability.count({ where: { providerId } });
    if (count > 0) continue;
    for (const s of availabilitySpecs.filter((x) => x.email === spec.email)) {
      await prisma.availability.create({ data: { providerId, kind: s.kind, startsAt: zonedDateTimeToUtc(d(s.from[0]), s.from[1]), endsAt: zonedDateTimeToUtc(d(s.to[0]), s.to[1]), note: s.note ?? null } });
    }
  }

  // Applications & contact (demo)
  if ((await prisma.application.count()) === 0) {
    await prisma.application.createMany({
      data: [
        { kind: "PROVIDER", name: "Inès Caron", email: "ines.caron@example.test", phone: "06 00 00 00 51", city: "Vienne", sector: "Vienne et sud de Lyon", message: "Animatrice BAFA, disponible les samedis. (candidature de démonstration)", privacyAcceptedAt: new Date() },
        { kind: "PARTNER", name: "Julie Marchand", email: "julie@manoir-exemple.example.test", organisation: "Manoir des Érables (fictif)", city: "Chaponost", message: "Nous accueillons une vingtaine de mariages par an et aimerions proposer votre service à nos couples. (démonstration)", privacyAcceptedAt: new Date() },
      ],
    });
  }
}

async function main() {
  await seedBaseline();
  console.log("[seed] baseline settings, options and editable texts are in place");
  if (!env.DEMO_MODE) {
    console.log("[seed] DEMO_MODE is off: demo accounts and fictitious data were NOT created");
    return;
  }
  await seedDemo();
  console.log("[seed] demo data in place (accounts, 3 fictitious venues, 8 events, 5 providers)");
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
