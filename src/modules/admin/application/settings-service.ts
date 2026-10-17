import { eq, inArray } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { configurationSettings } from "@/db/schema";
import { ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireGlobalPermission } from "@/modules/authorization";
import { recordAudit } from "@/modules/admin/application/audit";

/**
 * Key/value configuration edited from the back-office. Each known key has a
 * type so the UI renders the right control and the value is validated.
 */
export type SettingKind = "text" | "boolean" | "integer";

export type SettingDefinition = { key: string; kind: SettingKind; label: string; group: "legal" | "retention" | "billing" | "directory" | "moderation"; min?: number; max?: number };

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  { key: "legal.company_name", kind: "text", label: "Raison sociale de l'éditeur", group: "legal" },
  { key: "legal.company_address", kind: "text", label: "Adresse du siège", group: "legal" },
  { key: "legal.siret", kind: "text", label: "SIRET", group: "legal" },
  { key: "legal.vat_number", kind: "text", label: "Numéro de TVA intracommunautaire", group: "legal" },
  { key: "legal.publication_director", kind: "text", label: "Responsable de la publication", group: "legal" },
  { key: "legal.dpo_email", kind: "text", label: "E-mail du délégué à la protection des données", group: "legal" },
  { key: "legal.host", kind: "text", label: "Hébergeur", group: "legal" },
  { key: "legal.mediator", kind: "text", label: "Médiateur de la consommation", group: "legal" },
  { key: "retention.children_days_after_event", kind: "integer", label: "Jours après l'évènement avant anonymisation des données enfants", group: "retention", min: 1, max: 365 },
  { key: "retention.inactive_account_months", kind: "integer", label: "Mois d'inactivité avant suppression d'un compte", group: "retention", min: 12, max: 120 },
  { key: "retention.audit_logs_months", kind: "integer", label: "Conservation des journaux d'audit (mois)", group: "retention", min: 6, max: 120 },
  { key: "billing.live_enabled", kind: "boolean", label: "Paiement réel activé", group: "billing" },
  { key: "sponsored.max_per_query", kind: "integer", label: "Résultats sponsorisés max par recherche", group: "directory", min: 0, max: 5 },
  { key: "moderation.require_review_on_major_update", kind: "boolean", label: "Re-modération des modifications importantes d'une page publiée", group: "moderation" },
];

export async function getSetting<T>(key: string, fallback: T, executor: DbExecutor = db): Promise<T> {
  const [row] = await executor.select({ value: configurationSettings.value }).from(configurationSettings).where(eq(configurationSettings.key, key)).limit(1);
  if (!row) return fallback;
  return (row.value as T) ?? fallback;
}

export async function getSettings(keys: string[], executor: DbExecutor = db): Promise<Record<string, unknown>> {
  if (keys.length === 0) return {};
  const rows = await executor.select().from(configurationSettings).where(inArray(configurationSettings.key, keys));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function listSettings(executor: DbExecutor = db) {
  return executor.select().from(configurationSettings).orderBy(configurationSettings.key);
}

/** Legal variables for editorial pages: only `legal.*` keys are exposed to templates. */
export async function getLegalVariables(executor: DbExecutor = db): Promise<Record<string, string>> {
  const rows = await executor.select().from(configurationSettings);
  const out: Record<string, string> = {};
  for (const r of rows) if (r.key.startsWith("legal.") && typeof r.value === "string") out[r.key] = r.value;
  return out;
}

export function coerceSettingValue(def: SettingDefinition, raw: string): unknown {
  switch (def.kind) {
    case "boolean":
      return raw === "true" || raw === "on" || raw === "1";
    case "integer": {
      const n = Number.parseInt(raw, 10);
      if (!Number.isInteger(n)) throw new ValidationError("Valeur entière attendue.");
      if (def.min !== undefined && n < def.min) throw new ValidationError(`Minimum ${def.min}.`);
      if (def.max !== undefined && n > def.max) throw new ValidationError(`Maximum ${def.max}.`);
      return n;
    }
    default: {
      const s = raw.trim();
      if (s.length > 500) throw new ValidationError("Texte trop long (500 caractères max).");
      return s;
    }
  }
}

export async function updateSetting(actor: Actor, key: string, raw: string, executor: DbExecutor = db): Promise<void> {
  requireGlobalPermission(actor, "admin.settings.manage");
  const def = SETTING_DEFINITIONS.find((d) => d.key === key);
  if (!def) throw new ValidationError("Paramètre inconnu.");
  const value = coerceSettingValue(def, raw);
  const previous = await getSetting<unknown>(key, null, executor);
  await executor
    .insert(configurationSettings)
    .values({ key, value, updatedByUserId: actor.userId })
    .onConflictDoUpdate({ target: configurationSettings.key, set: { value, updatedByUserId: actor.userId } });
  await recordAudit(executor, {
    actorUserId: actor.userId,
    action: "admin.setting.updated",
    resourceType: "configuration_setting",
    resourceId: key,
    // Legal variables may contain an address: only log that it changed.
    metadata: def.group === "legal" ? { changed: true } : { previous, value },
  });
}
