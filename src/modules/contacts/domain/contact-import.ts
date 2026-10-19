import { mapHeaders } from "./csv";
import { computeDedupeKey, normalizeEmail, normalizePhoneFr, titleCaseName } from "./normalize";

export const CONTACT_CATEGORIES = ["client", "provider", "partner", "family", "friend", "colleague", "other"] as const;
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];
export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  client: "Client",
  provider: "Prestataire",
  partner: "Partenaire",
  family: "Famille",
  friend: "Ami",
  colleague: "Collègue",
  other: "Autre",
};

export function normalizeCategory(input: string | null | undefined): ContactCategory | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  const direct = CONTACT_CATEGORIES.find((c) => c === v);
  if (direct) return direct;
  const byLabel = (Object.entries(CONTACT_CATEGORY_LABELS) as Array<[ContactCategory, string]>).find(([, label]) => label.toLowerCase() === v);
  if (byLabel) return byLabel[0];
  const aliases: Record<string, ContactCategory> = { prestataire: "provider", fournisseur: "provider", vendor: "provider", partenaire: "partner", famille: "family", ami: "friend", amie: "friend", amis: "friend", collegue: "colleague", collègue: "colleague", collegues: "colleague", autre: "other" };
  return aliases[v] ?? null;
}

export type ContactDraft = {
  firstName: string;
  lastName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  category: ContactCategory | null;
  tags: string[];
  notes: string | null;
  dedupeKey: string | null;
};

export type ContactField = "firstName" | "lastName" | "fullName" | "company" | "email" | "phone" | "category" | "tags" | "notes";

/** FR/EN header aliases (normalised: lower-case, no accents). */
export const CONTACT_HEADER_ALIASES: Record<ContactField, readonly string[]> = {
  firstName: ["prenom", "first name", "firstname", "given name", "prénom"],
  lastName: ["nom", "nom de famille", "last name", "lastname", "surname", "family name"],
  fullName: ["nom complet", "full name", "name", "contact", "nom et prenom", "nom prenom"],
  company: ["societe", "entreprise", "company", "organisation", "organization", "structure"],
  email: ["email", "e mail", "courriel", "mail", "adresse email", "adresse e mail", "email address"],
  phone: ["telephone", "tel", "phone", "mobile", "portable", "phone number", "numero", "numero de telephone"],
  category: ["categorie", "category", "type", "role"],
  tags: ["tags", "etiquettes", "labels", "mots cles", "groupes"],
  notes: ["notes", "note", "commentaire", "commentaires", "comments", "remarques"],
};

export type ImportRowError = { line: number; message: string };
export type ContactImportResult = { drafts: Array<ContactDraft & { line: number }>; errors: ImportRowError[]; unmappedHeaders: string[]; mappedFields: ContactField[] };

export function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return Array.from(new Set(raw.split(/[;,|/]/).map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, 20);
}

export function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

/** Turns parsed CSV rows into validated contact drafts (line numbers are 1-based, header = line 1). */
export function rowsToContactDrafts(headers: string[], rows: string[][]): ContactImportResult {
  const { columns, unmapped } = mapHeaders(headers, CONTACT_HEADER_ALIASES);
  const mappedFields = Object.keys(columns) as ContactField[];
  const drafts: Array<ContactDraft & { line: number }> = [];
  const errors: ImportRowError[] = [];
  const get = (row: string[], f: ContactField) => (columns[f] === undefined ? undefined : row[columns[f]!]);
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
    const rawEmail = get(row, "email");
    const rawPhone = get(row, "phone");
    const email = normalizeEmail(rawEmail);
    const phone = normalizePhoneFr(rawPhone);
    if (rawEmail && !email) errors.push({ line, message: `E-mail invalide : « ${rawEmail} »` });
    if (rawPhone && !phone) errors.push({ line, message: `Téléphone non reconnu : « ${rawPhone} »` });
    const company = (get(row, "company") ?? "").trim() || null;
    if (!firstName && !lastName && !company && !email) {
      errors.push({ line, message: "Ligne ignorée : ni nom, ni société, ni e-mail." });
      return;
    }
    drafts.push({
      line,
      firstName,
      lastName,
      company,
      email,
      phone,
      category: normalizeCategory(get(row, "category")),
      tags: parseTags(get(row, "tags")),
      notes: (get(row, "notes") ?? "").trim() || null,
      dedupeKey: computeDedupeKey({ email, phone }),
    });
  });
  return { drafts, errors, unmappedHeaders: unmapped, mappedFields };
}

export type DuplicateGroup<T> = { key: string; items: T[] };

/** Groups contacts sharing the same dedupe key (at least two items). */
export function findDuplicateGroups<T extends { dedupeKey: string | null }>(items: T[]): DuplicateGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    if (!it.dedupeKey) continue;
    const list = map.get(it.dedupeKey) ?? [];
    list.push(it);
    map.set(it.dedupeKey, list);
  }
  return Array.from(map.entries())
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, items: list }));
}

export type MergeableContact = { firstName: string; lastName: string; company: string | null; email: string | null; phone: string | null; category: string | null; tags: string[]; notes: string | null };

/** Merge rule: the primary wins, empty fields are filled from the others, tags are unioned, notes concatenated. */
export function mergeContacts<T extends MergeableContact>(primary: T, others: MergeableContact[]): MergeableContact {
  const result: MergeableContact = { ...primary, tags: [...primary.tags] };
  for (const o of others) {
    if (!result.firstName) result.firstName = o.firstName;
    if (!result.lastName) result.lastName = o.lastName;
    if (!result.company) result.company = o.company;
    if (!result.email) result.email = o.email;
    if (!result.phone) result.phone = o.phone;
    if (!result.category) result.category = o.category;
    for (const t of o.tags) if (!result.tags.includes(t)) result.tags.push(t);
    if (o.notes && o.notes !== result.notes) result.notes = result.notes ? `${result.notes}\n${o.notes}` : o.notes;
  }
  return result;
}

export const CONTACT_EXPORT_HEADERS = ["Prénom", "Nom", "Société", "E-mail", "Téléphone", "Catégorie", "Tags", "Notes"] as const;

export function contactToCsvRow(c: MergeableContact): Array<string | null> {
  return [c.firstName, c.lastName, c.company, c.email, c.phone, c.category ? (CONTACT_CATEGORY_LABELS[c.category as ContactCategory] ?? c.category) : null, c.tags.join(", "), c.notes];
}
