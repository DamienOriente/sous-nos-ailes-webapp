import { z } from "zod";

/**
 * Conditional onboarding forms. One declarative definition per `formSchemaKey`
 * drives both the rendering (fields, options, help texts) and the Zod schema
 * that validates `professionals.tradeDetails`.
 */
export const TRADE_FORM_KEYS = ["childcare", "dj", "venue", "caterer", "photo", "animation", "planner", "generic"] as const;
export type TradeFormKey = (typeof TRADE_FORM_KEYS)[number];

export type FieldOption = { value: string; label: string };
export type TradeField =
  | { name: string; label: string; type: "text"; required?: boolean; help?: string; placeholder?: string; maxLength?: number }
  | { name: string; label: string; type: "textarea"; required?: boolean; help?: string; placeholder?: string; maxLength?: number }
  | { name: string; label: string; type: "number"; required?: boolean; help?: string; min?: number; max?: number; unit?: string }
  | { name: string; label: string; type: "select"; required?: boolean; help?: string; options: FieldOption[] }
  | { name: string; label: string; type: "multiselect"; required?: boolean; help?: string; options: FieldOption[]; minSelected?: number }
  | { name: string; label: string; type: "checkbox"; help?: string };

export type TradeFormDefinition = {
  key: TradeFormKey;
  title: string;
  intro: string;
  fields: TradeField[];
  /** Supporting documents the professional will be asked for (informational, never blocking). */
  requiredDocuments: string[];
};

const AGE_RANGES: FieldOption[] = [
  { value: "0-1", label: "Bébés (0–1 an)" },
  { value: "1-3", label: "Tout-petits (1–3 ans)" },
  { value: "3-6", label: "Maternelle (3–6 ans)" },
  { value: "6-10", label: "Primaire (6–10 ans)" },
  { value: "10-14", label: "Pré-ados (10–14 ans)" },
];

const EVENT_DURATIONS: FieldOption[] = [
  { value: "lt2h", label: "Moins de 2 h" },
  { value: "2-4h", label: "2 à 4 h" },
  { value: "half_day", label: "Demi-journée" },
  { value: "full_day", label: "Journée complète" },
  { value: "evening_night", label: "Soirée et nuit" },
];

export const TRADE_FORMS: Record<TradeFormKey, TradeFormDefinition> = {
  childcare: {
    key: "childcare",
    title: "Votre activité de garde d'enfants",
    intro: "Ces informations rassurent les organisateurs. Les éléments déclarés ici restent déclaratifs tant qu'un justificatif n'a pas été examiné.",
    fields: [
      { name: "experienceYears", label: "Années d'expérience auprès d'enfants", type: "number", required: true, min: 0, max: 60, unit: "ans" },
      { name: "ageRanges", label: "Tranches d'âge accueillies", type: "multiselect", required: true, options: AGE_RANGES, minSelected: 1 },
      {
        name: "services",
        label: "Prestations proposées",
        type: "multiselect",
        required: true,
        minSelected: 1,
        options: [
          { value: "supervision", label: "Garde et surveillance pendant la réception" },
          { value: "activities", label: "Ateliers et jeux encadrés" },
          { value: "nap_space", label: "Espace sieste / coin calme" },
          { value: "meals", label: "Aide au repas des enfants" },
          { value: "night", label: "Garde de nuit sur place" },
          { value: "ceremony", label: "Accompagnement pendant la cérémonie" },
        ],
      },
      {
        name: "legalStatus",
        label: "Statut d'exercice",
        type: "select",
        required: true,
        options: [
          { value: "micro", label: "Micro-entrepreneur" },
          { value: "company", label: "Société (SARL, SAS…)" },
          { value: "association", label: "Association" },
          { value: "employee_agency", label: "Salarié d'une agence" },
          { value: "other", label: "Autre" },
        ],
      },
      { name: "maxChildrenPerStaff", label: "Nombre maximal d'enfants par intervenant (déclaré)", type: "number", required: true, min: 1, max: 15, help: "Ratio que vous vous engagez à respecter. Indicatif : 1 pour 3 chez les moins de 3 ans, 1 pour 8 au-delà." },
      { name: "qualifications", label: "Diplômes et formations (déclaratif)", type: "textarea", placeholder: "CAP AEPE, PSC1, BAFA, auxiliaire de puériculture…", maxLength: 600 },
      { name: "teamSize", label: "Taille de l'équipe mobilisable", type: "number", min: 1, max: 100, unit: "personnes" },
      { name: "insuranceDeclared", label: "Je déclare détenir une assurance responsabilité civile professionnelle", type: "checkbox", help: "Vous pourrez transmettre l'attestation dans l'onglet Vérification." },
    ],
    requiredDocuments: ["Extrait Kbis ou avis de situation SIRENE", "Attestation d'assurance RC professionnelle", "Diplômes ou attestations de formation (PSC1, CAP AEPE…)", "Extrait de casier judiciaire (bulletin n°3) pour chaque intervenant — conservé par vous, présenté sur demande"],
  },
  animation: {
    key: "animation",
    title: "Vos animations",
    intro: "Décrivez ce que vous proposez et pour quels publics.",
    fields: [
      {
        name: "animationTypes",
        label: "Types d'animation",
        type: "multiselect",
        required: true,
        minSelected: 1,
        options: [
          { value: "workshops", label: "Ateliers créatifs" },
          { value: "games", label: "Jeux et olympiades" },
          { value: "show", label: "Spectacle" },
          { value: "magic", label: "Magie" },
          { value: "face_painting", label: "Maquillage enfants" },
          { value: "music", label: "Éveil musical" },
          { value: "mc", label: "Maître de cérémonie / animation de soirée" },
          { value: "team_building", label: "Team building" },
        ],
      },
      { name: "ageRanges", label: "Tranches d'âge concernées", type: "multiselect", options: [...AGE_RANGES, { value: "adults", label: "Adultes" }] },
      { name: "durations", label: "Durées proposées", type: "multiselect", options: EVENT_DURATIONS },
      { name: "maxParticipants", label: "Nombre maximal de participants par animateur", type: "number", min: 1, max: 500 },
      { name: "materialsIncluded", label: "Matériel fourni par mes soins", type: "checkbox" },
      { name: "experienceYears", label: "Années d'expérience", type: "number", min: 0, max: 60, unit: "ans" },
    ],
    requiredDocuments: ["Extrait Kbis ou avis de situation SIRENE", "Attestation d'assurance RC professionnelle"],
  },
  dj: {
    key: "dj",
    title: "Votre prestation musicale",
    intro: "Matériel, styles et conditions techniques.",
    fields: [
      { name: "styles", label: "Styles musicaux", type: "multiselect", required: true, minSelected: 1, options: ["Généraliste", "Pop / variété", "Électro / house", "Hip-hop / R&B", "Rock", "Jazz / soul", "Latino", "Années 80-90", "Classique / cérémonie"].map((s) => ({ value: s, label: s })) },
      { name: "equipment", label: "Matériel fourni", type: "multiselect", options: ["Sonorisation", "Éclairage", "Micro HF", "Machine à fumée", "Vidéoprojecteur", "Écran LED"].map((s) => ({ value: s, label: s })) },
      { name: "maxGuests", label: "Jauge maximale couverte", type: "number", min: 10, max: 5000, unit: "invités" },
      { name: "setupMinutes", label: "Temps d'installation", type: "number", min: 15, max: 600, unit: "minutes" },
      { name: "powerRequirements", label: "Besoins électriques et accès", type: "textarea", placeholder: "2 prises 16 A dédiées, accès véhicule à moins de 30 m…", maxLength: 500 },
      { name: "ceremonyMusic", label: "Je propose aussi la sonorisation de cérémonie", type: "checkbox" },
    ],
    requiredDocuments: ["Extrait Kbis ou avis de situation SIRENE", "Attestation d'assurance RC professionnelle"],
  },
  venue: {
    key: "venue",
    title: "Votre lieu",
    intro: "Capacités et équipements pour que les organisateurs sachent tout de suite si le lieu convient.",
    fields: [
      { name: "seatedCapacity", label: "Capacité assise", type: "number", required: true, min: 1, max: 5000, unit: "personnes" },
      { name: "standingCapacity", label: "Capacité debout / cocktail", type: "number", min: 1, max: 10000, unit: "personnes" },
      { name: "lodgingBeds", label: "Couchages sur place", type: "number", min: 0, max: 1000, unit: "lits" },
      {
        name: "amenities",
        label: "Équipements",
        type: "multiselect",
        options: ["Cuisine professionnelle", "Parking", "Accès PMR", "Espace extérieur", "Chapiteau possible", "Piste de danse", "Sonorisation", "Espace enfants dédié", "Hébergement", "Piscine"].map((s) => ({ value: s, label: s })),
      },
      { name: "catererPolicy", label: "Traiteur", type: "select", required: true, options: [{ value: "free", label: "Libre choix du traiteur" }, { value: "list", label: "Liste de traiteurs partenaires" }, { value: "exclusive", label: "Traiteur exclusif imposé" }] },
      { name: "noiseCurfew", label: "Heure limite de musique", type: "text", placeholder: "ex. 3 h du matin", maxLength: 40 },
      { name: "childrenSpace", label: "Un espace sécurisé pour les enfants peut être mis à disposition", type: "checkbox" },
    ],
    requiredDocuments: ["Extrait Kbis ou avis de situation SIRENE", "Attestation d'assurance RC professionnelle", "Autorisation d'ouverture au public (ERP) si applicable"],
  },
  caterer: {
    key: "caterer",
    title: "Votre offre traiteur",
    intro: "Cuisines, régimes et niveau de service.",
    fields: [
      { name: "cuisines", label: "Types de cuisine", type: "multiselect", required: true, minSelected: 1, options: ["Française", "Méditerranéenne", "Occitane / terroir", "Asiatique", "Orientale", "Végétarienne", "Pâtisserie", "Food truck", "Cocktail dînatoire"].map((s) => ({ value: s, label: s })) },
      { name: "diets", label: "Régimes gérés", type: "multiselect", options: ["Végétarien", "Végan", "Sans gluten", "Sans lactose", "Halal", "Casher", "Allergies (protocole)", "Menus enfants"].map((s) => ({ value: s, label: s })) },
      { name: "minGuests", label: "Nombre minimal de couverts", type: "number", min: 1, max: 5000 },
      { name: "maxGuests", label: "Nombre maximal de couverts", type: "number", min: 1, max: 10000 },
      { name: "serviceIncluded", label: "Service en salle compris", type: "checkbox" },
      { name: "rentalIncluded", label: "Vaisselle et nappage compris", type: "checkbox" },
      { name: "tasting", label: "Dégustation proposée avant signature", type: "checkbox" },
    ],
    requiredDocuments: ["Extrait Kbis ou avis de situation SIRENE", "Attestation d'assurance RC professionnelle", "Déclaration d'activité auprès de la DDPP (hygiène alimentaire)"],
  },
  photo: {
    key: "photo",
    title: "Votre travail d'image",
    intro: "Style, livrables et délais.",
    fields: [
      { name: "styles", label: "Style", type: "multiselect", required: true, minSelected: 1, options: ["Reportage / naturel", "Éditorial", "Fine art", "Argentique", "Noir et blanc", "Documentaire", "Posé / studio"].map((s) => ({ value: s, label: s })) },
      { name: "deliverables", label: "Livrables", type: "multiselect", options: ["Galerie en ligne", "Fichiers HD", "Album imprimé", "Tirages", "Film court", "Film long", "Teaser réseaux", "Drone"].map((s) => ({ value: s, label: s })) },
      { name: "deliveryWeeks", label: "Délai de livraison", type: "number", min: 1, max: 52, unit: "semaines" },
      { name: "coverageHours", label: "Durée de couverture habituelle", type: "number", min: 1, max: 24, unit: "heures" },
      { name: "secondShooter", label: "Second photographe possible", type: "checkbox" },
      { name: "childrenFriendly", label: "Expérience avec les enfants (photos spontanées, patience)", type: "checkbox" },
    ],
    requiredDocuments: ["Extrait Kbis ou avis de situation SIRENE", "Attestation d'assurance RC professionnelle"],
  },
  planner: {
    key: "planner",
    title: "Vos formules d'organisation",
    intro: "Ce que vous prenez en charge.",
    fields: [
      { name: "packages", label: "Formules", type: "multiselect", required: true, minSelected: 1, options: [{ value: "full", label: "Organisation complète" }, { value: "partial", label: "Organisation partielle" }, { value: "day_of", label: "Coordination du jour J" }, { value: "consulting", label: "Conseil à la carte" }, { value: "design", label: "Design et scénographie" }] },
      { name: "eventsPerYear", label: "Évènements coordonnés par an", type: "number", min: 1, max: 500 },
      { name: "teamSize", label: "Taille de l'équipe", type: "number", min: 1, max: 50, unit: "personnes" },
      { name: "experienceYears", label: "Années d'expérience", type: "number", min: 0, max: 60, unit: "ans" },
      { name: "childcareCoordination", label: "Je coordonne la garde d'enfants et les animations jeunesse", type: "checkbox" },
    ],
    requiredDocuments: ["Extrait Kbis ou avis de situation SIRENE", "Attestation d'assurance RC professionnelle"],
  },
  generic: {
    key: "generic",
    title: "Votre activité",
    intro: "Quelques précisions utiles aux organisateurs.",
    fields: [
      { name: "specialties", label: "Spécialités", type: "textarea", required: true, placeholder: "Décrivez vos spécialités en quelques lignes.", maxLength: 600 },
      { name: "experienceYears", label: "Années d'expérience", type: "number", min: 0, max: 60, unit: "ans" },
      { name: "durations", label: "Durées d'intervention", type: "multiselect", options: EVENT_DURATIONS },
      { name: "travelIncluded", label: "Déplacement inclus dans la zone d'intervention", type: "checkbox" },
    ],
    requiredDocuments: ["Extrait Kbis ou avis de situation SIRENE", "Attestation d'assurance RC professionnelle"],
  },
};

export function isTradeFormKey(key: string): key is TradeFormKey {
  return (TRADE_FORM_KEYS as readonly string[]).includes(key);
}

export function getTradeForm(key: string): TradeFormDefinition {
  return isTradeFormKey(key) ? TRADE_FORMS[key] : TRADE_FORMS.generic;
}

function fieldSchema(f: TradeField): z.ZodType {
  switch (f.type) {
    case "text":
    case "textarea": {
      const base = z.string().trim().max(f.maxLength ?? 1000);
      return f.required ? base.min(1, "Champ requis") : base.optional().or(z.literal(""));
    }
    case "number": {
      let n = z.coerce.number();
      if (f.min !== undefined) n = n.min(f.min);
      if (f.max !== undefined) n = n.max(f.max);
      return f.required ? n : n.optional().nullable();
    }
    case "select": {
      const values = f.options.map((o) => o.value) as [string, ...string[]];
      const e = z.enum(values);
      return f.required ? e : e.optional().or(z.literal(""));
    }
    case "multiselect": {
      const values = f.options.map((o) => o.value) as [string, ...string[]];
      const arr = z.array(z.enum(values));
      return f.required ? arr.min(f.minSelected ?? 1, "Sélectionnez au moins une option") : arr.optional().default([]);
    }
    case "checkbox":
      return z.boolean().optional().default(false);
  }
}

/** Zod object validating `tradeDetails` for a given form key. Unknown keys are dropped. */
export function buildTradeSchema(key: string): z.ZodObject<Record<string, z.ZodType>> {
  const def = getTradeForm(key);
  const shape: Record<string, z.ZodType> = {};
  for (const f of def.fields) shape[f.name] = fieldSchema(f);
  return z.object(shape);
}

/**
 * Converts a FormData into the raw object expected by the schema: multiselect →
 * string[], checkbox → boolean, empty numbers → null.
 */
export function tradeFormDataToObject(key: string, form: FormData, prefix = "trade."): Record<string, unknown> {
  const def = getTradeForm(key);
  const out: Record<string, unknown> = {};
  for (const f of def.fields) {
    const name = `${prefix}${f.name}`;
    switch (f.type) {
      case "multiselect":
        out[f.name] = form.getAll(name).map(String);
        break;
      case "checkbox":
        out[f.name] = form.get(name) === "on" || form.get(name) === "true";
        break;
      case "number": {
        const v = form.get(name);
        out[f.name] = v === null || v === "" ? null : v;
        break;
      }
      default:
        out[f.name] = form.get(name) ?? "";
    }
  }
  return out;
}

/** Human-readable summary lines (label → value) for recap and public display. */
export function summarizeTradeDetails(key: string, details: Record<string, unknown>): Array<{ label: string; value: string }> {
  const def = getTradeForm(key);
  const lines: Array<{ label: string; value: string }> = [];
  for (const f of def.fields) {
    const v = details[f.name];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || v === false) continue;
    if (f.type === "checkbox") lines.push({ label: f.label, value: "Oui" });
    else if (f.type === "multiselect" && Array.isArray(v)) lines.push({ label: f.label, value: v.map((x) => f.options.find((o) => o.value === x)?.label ?? String(x)).join(", ") });
    else if (f.type === "select") lines.push({ label: f.label, value: f.options.find((o) => o.value === v)?.label ?? String(v) });
    else if (f.type === "number") lines.push({ label: f.label, value: `${String(v)}${f.unit ? ` ${f.unit}` : ""}` });
    else lines.push({ label: f.label, value: String(v) });
  }
  return lines;
}
