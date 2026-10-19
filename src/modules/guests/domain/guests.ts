import { mapHeaders } from "@/modules/contacts/domain/csv";
import { normalizeEmail, normalizePhoneFr, titleCaseName } from "@/modules/contacts/domain/normalize";
import { splitFullName } from "@/modules/contacts/domain/contact-import";

export const RSVP_STATUSES = ["pending", "accepted", "declined", "maybe"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];
export const RSVP_LABELS: Record<RsvpStatus, string> = { pending: "En attente", accepted: "Accepté", declined: "Refusé", maybe: "Peut-être" };
export const RSVP_TONES: Record<RsvpStatus, "neutral" | "success" | "danger" | "warning"> = { pending: "neutral", accepted: "success", declined: "danger", maybe: "warning" };

export const GUEST_SIDES = ["mariée", "marié", "commun"] as const;

/** Dietary labels only (no medical information). Free text is also accepted. */
export const DIETARY_SUGGESTIONS = ["Végétarien", "Végétalien", "Sans porc", "Sans gluten", "Sans lactose", "Halal", "Casher", "Pescétarien"] as const;

export type GuestLike = { isChild: boolean; rsvpStatus: RsvpStatus; rsvpGuestsCount: number | null; plusOnesAllowed: number };

export type RsvpStats = { total: number; accepted: number; declined: number; maybe: number; pending: number; children: number; expectedHeadcount: number };

/** Headcount = accepted guests (+ their announced companions) + maybe counted as 1. */
export function computeRsvpStats(guests: GuestLike[]): RsvpStats {
  const stats: RsvpStats = { total: guests.length, accepted: 0, declined: 0, maybe: 0, pending: 0, children: 0, expectedHeadcount: 0 };
  for (const g of guests) {
    stats[g.rsvpStatus] += 1;
    if (g.isChild) stats.children += 1;
    if (g.rsvpStatus === "accepted") stats.expectedHeadcount += Math.max(1, g.rsvpGuestsCount ?? 1);
    else if (g.rsvpStatus === "maybe") stats.expectedHeadcount += 1;
  }
  return stats;
}

export type GuestField = "firstName" | "lastName" | "fullName" | "email" | "phone" | "group" | "isChild" | "ageYears" | "dietaryPreference" | "plusOnesAllowed" | "notes";

export const GUEST_HEADER_ALIASES: Record<GuestField, readonly string[]> = {
  firstName: ["prenom", "first name", "firstname", "prénom"],
  lastName: ["nom", "nom de famille", "last name", "lastname", "surname"],
  fullName: ["nom complet", "full name", "name", "invite", "invité", "guest"],
  email: ["email", "e mail", "courriel", "mail", "adresse email"],
  phone: ["telephone", "tel", "phone", "mobile", "portable"],
  group: ["groupe", "group", "famille", "table", "cote", "side", "categorie"],
  isChild: ["enfant", "child", "is child", "kid", "mineur"],
  ageYears: ["age", "age ans", "years", "age years"],
  dietaryPreference: ["regime", "regime alimentaire", "preference alimentaire", "diet", "dietary", "alimentation"],
  plusOnesAllowed: ["accompagnants", "accompagnant", "plus ones", "plus one", "plus 1", "nb accompagnants", "invites supplementaires"],
  notes: ["notes", "note", "commentaire", "remarques", "comments"],
};

export type GuestDraft = {
  line: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  groupName: string | null;
  isChild: boolean;
  ageYears: number | null;
  dietaryPreference: string | null;
  plusOnesAllowed: number;
  notes: string | null;
};

export function parseBooleanFr(raw: string | undefined): boolean {
  if (!raw) return false;
  return ["oui", "yes", "true", "1", "x", "o", "y", "enfant", "child"].includes(raw.trim().toLowerCase());
}

export function rowsToGuestDrafts(headers: string[], rows: string[][]): { drafts: GuestDraft[]; errors: Array<{ line: number; message: string }>; unmappedHeaders: string[] } {
  const { columns, unmapped } = mapHeaders(headers, GUEST_HEADER_ALIASES);
  const drafts: GuestDraft[] = [];
  const errors: Array<{ line: number; message: string }> = [];
  const get = (row: string[], f: GuestField) => (columns[f] === undefined ? undefined : row[columns[f]!]);
  rows.forEach((row, idx) => {
    const line = idx + 2;
    let firstName = get(row, "firstName") ?? "";
    let lastName = get(row, "lastName") ?? "";
    if (!firstName && !lastName) {
      const full = get(row, "fullName");
      if (full) ({ firstName, lastName } = splitFullName(full));
    }
    firstName = titleCaseName(firstName);
    lastName = titleCaseName(lastName);
    if (!firstName && !lastName) {
      errors.push({ line, message: "Ligne ignorée : aucun nom." });
      return;
    }
    const rawEmail = get(row, "email");
    const rawPhone = get(row, "phone");
    const email = normalizeEmail(rawEmail);
    const phone = normalizePhoneFr(rawPhone);
    if (rawEmail && !email) errors.push({ line, message: `E-mail invalide : « ${rawEmail} »` });
    if (rawPhone && !phone) errors.push({ line, message: `Téléphone non reconnu : « ${rawPhone} »` });
    const ageRaw = get(row, "ageYears");
    const age = ageRaw ? Number.parseInt(ageRaw, 10) : NaN;
    const ageYears = Number.isFinite(age) && age >= 0 && age <= 17 ? age : null;
    const isChild = parseBooleanFr(get(row, "isChild")) || ageYears !== null;
    const plusRaw = get(row, "plusOnesAllowed");
    const plus = plusRaw ? Number.parseInt(plusRaw, 10) : 0;
    drafts.push({
      line,
      firstName: firstName || "Invité",
      lastName,
      email,
      phone,
      groupName: (get(row, "group") ?? "").trim() || null,
      isChild,
      ageYears: isChild ? ageYears : null,
      dietaryPreference: (get(row, "dietaryPreference") ?? "").trim().slice(0, 80) || null,
      plusOnesAllowed: Number.isFinite(plus) && plus >= 0 ? Math.min(plus, 10) : 0,
      notes: (get(row, "notes") ?? "").trim() || null,
    });
  });
  return { drafts, errors, unmappedHeaders: unmapped };
}

export const GUEST_EXPORT_HEADERS = ["Prénom", "Nom", "E-mail", "Téléphone", "Groupe", "Enfant", "Âge", "Régime", "Accompagnants autorisés", "RSVP", "Personnes annoncées", "Message", "Notes"] as const;

export function guestToCsvRow(g: { firstName: string; lastName: string; email: string | null; phone: string | null; groupName: string | null; isChild: boolean; ageYears: number | null; dietaryPreference: string | null; plusOnesAllowed: number; rsvpStatus: RsvpStatus; rsvpGuestsCount: number | null; rsvpMessage: string | null; notes: string | null }): Array<string | number | null> {
  return [g.firstName, g.lastName, g.email, g.phone, g.groupName, g.isChild ? "oui" : "non", g.ageYears, g.dietaryPreference, g.plusOnesAllowed, RSVP_LABELS[g.rsvpStatus], g.rsvpGuestsCount, g.rsvpMessage, g.notes];
}

export function guestDisplayName(g: { firstName: string; lastName: string }): string {
  return `${g.firstName} ${g.lastName}`.trim();
}
