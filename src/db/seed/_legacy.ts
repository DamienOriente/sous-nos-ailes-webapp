import { sql } from "drizzle-orm";
import type { SeedContext } from "./context";

/**
 * Earlier versions of the demo data used the long dash (U+2014) in titles,
 * display names and sentences. Seeds that insert once ("only if missing") or
 * match rows by title would leave those texts in an existing database, or
 * duplicate the rows under their new titles. This module converges an
 * existing database to the current wording. On a fresh database it is a no-op.
 */
const DASH = String.fromCharCode(0x2014);

/** Titles of generated documents: new title -> title used before the dash was removed. */
const LEGACY_DOCUMENT_TITLES: Record<string, string> = {
  "Contrat garde d'enfants, Les Petits Ailés": `Contrat garde d'enfants ${DASH} Les Petits Ailés`,
  "Contrat de location, Domaine des Tilleuls": `Contrat de location ${DASH} Domaine des Tilleuls`,
  "Devis traiteur v2, Rossi Traiteur": `Devis traiteur v2 ${DASH} Rossi Traiteur`,
  "Contrat reportage photo, Inès Garnier": `Contrat reportage photo ${DASH} Inès Garnier`,
  "Devis DJ & sonorisation, DJ Théo": `Devis DJ & sonorisation ${DASH} DJ Théo`,
  "Contrat de coordination, Camille Ferrand": `Contrat de coordination ${DASH} Camille Ferrand`,
  "Devis fleurs, Fleurs & Co": `Devis fleurs ${DASH} Fleurs & Co`,
  "Devis traiteur, Les Quais": `Devis traiteur ${DASH} Les Quais`,
  "Devis garde d'enfants, Marie Delcourt": `Devis garde d'enfants ${DASH} Marie Delcourt`,
  "Contrat traiteur, Julien Rossi": `Contrat traiteur ${DASH} Julien Rossi`,
  "Devis domaine, Hélène Vasseur": `Devis domaine ${DASH} Hélène Vasseur`,
};

/** The pre-dash title of a generated document, when it had one. */
export function legacyDocumentTitle(title: string): string | undefined {
  return LEGACY_DOCUMENT_TITLES[title];
}

/** Exact old -> new wordings, applied everywhere before the generic fallback. */
const EXACT: Array<[string, string]> = [
  [`Photos de couple ${DASH} golden hour`, "Photos de couple au coucher du soleil"],
  [`Domaine ${DASH} accès livraisons`, "Domaine, accès livraisons"],
  [`La grange ${DASH} coin calme`, "La grange, coin calme"],
  [`Atelier Beauté Lavaur ${DASH} 24 avril 10h, avec les deux témoins.`, "Atelier Beauté Lavaur, le 24 avril à 10h, avec les deux témoins."],
  [`Studio Papier ${DASH} même papier que les faire-part (vert sauge).`, "Studio Papier, même papier que les faire-part (vert sauge)."],
  [`Pauses, déjeuner, dîner ${DASH} 30 personnes.`, "Pauses, déjeuner, dîner pour 30 personnes."],
  [`Témoin référent : Maxime ${DASH} 06`, "Témoin référent : Maxime, 06"],
  [`Perfect ${DASH} Ed Sheeran (ouverture de bal)`, "Perfect (Ed Sheeran, ouverture de bal)"],
  [`September ${DASH} Earth, Wind & Fire`, "September (Earth, Wind & Fire)"],
  [`Les Champs-Élysées ${DASH} Joe Dassin`, "Les Champs-Élysées (Joe Dassin)"],
  [`Don't Stop Me Now ${DASH} Queen`, "Don't Stop Me Now (Queen)"],
  [`Danza Kuduro ${DASH} Don Omar`, "Danza Kuduro (Don Omar)"],
  [`Arachide ${DASH} réaction sévère.`, "Arachide, réaction sévère."],
  [`Pièce d'identité présentée ${DASH} confirmation`, "Pièce d'identité présentée, confirmation"],
  [`Témoin de Louis ${DASH} discours prévu.`, "Témoin de Louis, discours prévu."],
  [`Marie Delcourt ${DASH} Garde d'enfants évènementielle`, "Marie Delcourt, garde d'enfants évènementielle"],
  [`Camille Ferrand ${DASH} Wedding planner`, "Camille Ferrand, wedding planner"],
  [`Sofia Martins ${DASH} Animations enfants`, "Sofia Martins, animations enfants"],
  [`Fleurs Sauvages ${DASH} Atelier floral`, "Fleurs Sauvages, atelier floral"],
  [`HÉBERGEUR À COMPLÉTER ${DASH} infrastructure européenne`, "HÉBERGEUR À COMPLÉTER : infrastructure européenne"],
];

/** Text columns of demo or seed-written rows that may still hold the old wording. */
const TEXT_COLUMNS: Array<[table: string, column: string]> = [
  ["professionals", "display_name"],
  ["professionals", "tagline"],
  ["professionals", "description"],
  ["media_assets", "alt"],
  ["media_assets", "caption"],
  ["profile_versions", "seo_title"],
  ["profile_versions", "seo_description"],
  ["event_professionals", "notes"],
  ["event_documents", "title"],
  ["event_milestones", "title"],
  ["event_milestones", "location"],
  ["event_milestones", "description"],
  ["event_tasks", "description"],
  ["contacts", "notes"],
  ["child_handover_records", "identity_verified_how"],
  ["calendar_entries", "title"],
  ["calendar_entries", "description"],
  ["moderation_cases", "summary"],
  ["editorial_pages", "body"],
  ["image_briefs", "useful_contacts"],
  ["music_briefs", "playlist_text"],
  ["shot_list_items", "title"],
];

/** Columns holding JSON documents (the replacement runs on their text form). */
const JSON_COLUMNS: Array<[table: string, column: string]> = [
  ["profile_versions", "content"],
  ["configuration_settings", "value"],
];

/**
 * Renames the rows other seeds look up by title, so they are updated in place
 * instead of being inserted a second time. Runs before the events seed.
 */
export async function renameLegacyKeys(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  const [oldTitle, newTitle] = EXACT[0] as [string, string];
  await db.execute(sql`update event_milestones set title = ${newTitle} where title = ${oldTitle}`);
}

/**
 * Last pass (runs at the end of the seed): the exact rewrites, then a generic
 * ", " for any spaced long dash left in a seed-written text column.
 */
export async function scrubLegacyDashes(ctx: SeedContext): Promise<number> {
  const { db } = ctx;
  let touched = 0;
  const replaceChain = (col: ReturnType<typeof sql.identifier>, asJson: boolean) => {
    let expr = asJson ? sql`${col}::text` : sql`${col}`;
    for (const [from, to] of EXACT) expr = sql`replace(${expr}, ${from}, ${to})`;
    expr = sql`replace(${expr}, ${` ${DASH} `}, ${", "})`;
    return sql`replace(${expr}, ${DASH}, ${","})`;
  };
  for (const [table, column] of TEXT_COLUMNS) {
    const t = sql.identifier(table);
    const c = sql.identifier(column);
    const res = await db.execute(sql`update ${t} set ${c} = ${replaceChain(c, false)} where ${c} like ${`%${DASH}%`}`);
    touched += res.rowCount ?? 0;
  }
  for (const [table, column] of JSON_COLUMNS) {
    const t = sql.identifier(table);
    const c = sql.identifier(column);
    const res = await db.execute(sql`update ${t} set ${c} = (${replaceChain(c, true)})::jsonb where ${c}::text like ${`%${DASH}%`}`);
    touched += res.rowCount ?? 0;
  }
  return touched;
}
