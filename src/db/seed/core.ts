import { eq } from "drizzle-orm";
import {
  checklistTemplates,
  configurationSettings,
  planFeatures,
  plans,
  professionalCategories,
  toolDefinitions,
  userProfiles,
  users,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { CHECKLIST_SEED, EVENT_TYPES } from "@/modules/events/domain/event-types";
import { PLAN_SEED } from "@/modules/billing/domain/plans";
import { CATEGORY_SEED } from "@/modules/professionals/domain/categories";
import { TOOL_SEED } from "@/modules/tools/domain/tool-catalogue";
import { DEMO_PASSWORD, DEMO_USERS, type SeedContext } from "./context";

/** Reference data: idempotent upserts (safe to re-run after a deploy). */
export async function seedReferenceData(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  for (const c of CATEGORY_SEED) {
    const [row] = await db
      .insert(professionalCategories)
      .values({
        slug: c.slug,
        name: c.name,
        group: c.group,
        icon: c.icon,
        description: c.description,
        isChildcare: c.isChildcare ?? false,
        formSchemaKey: c.formSchemaKey,
        defaultTools: c.defaultTools,
        suggestedTemplates: c.suggestedTemplates,
        sortOrder: c.sortOrder,
      })
      .onConflictDoUpdate({
        target: professionalCategories.slug,
        set: { name: c.name, group: c.group, icon: c.icon, description: c.description, isChildcare: c.isChildcare ?? false, formSchemaKey: c.formSchemaKey, defaultTools: c.defaultTools, suggestedTemplates: c.suggestedTemplates, sortOrder: c.sortOrder },
      })
      .returning({ id: professionalCategories.id });
    if (row) ctx.categories[c.slug] = row.id;
  }

  for (const p of PLAN_SEED) {
    const [row] = await db
      .insert(plans)
      .values({ key: p.key, name: p.name, audience: p.audience, description: p.description, priceMonthlyCents: p.priceMonthlyCents, isDefault: p.isDefault, sortOrder: p.sortOrder })
      .onConflictDoUpdate({ target: plans.key, set: { name: p.name, description: p.description, isDefault: p.isDefault, sortOrder: p.sortOrder } })
      .returning({ id: plans.id });
    if (!row) continue;
    ctx.plans[p.key] = row.id;
    for (const [featureKey, f] of Object.entries(p.features)) {
      await db
        .insert(planFeatures)
        .values({ planId: row.id, featureKey, enabled: f.enabled, limitValue: f.limit ?? null })
        .onConflictDoUpdate({ target: [planFeatures.planId, planFeatures.featureKey], set: { enabled: f.enabled, limitValue: f.limit ?? null } });
    }
  }

  for (const t of TOOL_SEED) {
    await db
      .insert(toolDefinitions)
      .values({ key: t.key, name: t.name, description: t.description, audience: t.audience, requiredFeature: t.requiredFeature, categorySlugs: t.categorySlugs, sortOrder: t.sortOrder })
      .onConflictDoUpdate({ target: toolDefinitions.key, set: { name: t.name, description: t.description, audience: t.audience, requiredFeature: t.requiredFeature, categorySlugs: t.categorySlugs, sortOrder: t.sortOrder } });
  }

  // Checklist templates: replace per type (reference data, not user data).
  for (const type of EVENT_TYPES) {
    await db.delete(checklistTemplates).where(eq(checklistTemplates.eventType, type));
    const items = CHECKLIST_SEED[type];
    if (items.length) {
      await db.insert(checklistTemplates).values(items.map((i) => ({ eventType: type, section: i.section, title: i.title, description: i.description ?? null, dueDaysBefore: i.dueDaysBefore, sortOrder: i.sortOrder })));
    }
  }

  const settings: Array<{ key: string; value: unknown; description: string }> = [
    { key: "legal.company_name", value: "[RAISON SOCIALE À COMPLÉTER]", description: "Raison sociale de l'éditeur (mentions légales)" },
    { key: "legal.company_address", value: "[ADRESSE À COMPLÉTER]", description: "Adresse du siège" },
    { key: "legal.siret", value: "[SIRET À COMPLÉTER]", description: "SIRET de l'éditeur" },
    { key: "legal.vat_number", value: "[TVA INTRACOMMUNAUTAIRE À COMPLÉTER]", description: "Numéro de TVA" },
    { key: "legal.publication_director", value: "[RESPONSABLE DE PUBLICATION À COMPLÉTER]", description: "Responsable de la publication" },
    { key: "legal.dpo_email", value: "[E-MAIL DPO À COMPLÉTER]", description: "Contact délégué à la protection des données" },
    { key: "legal.host", value: "[HÉBERGEUR À COMPLÉTER : infrastructure européenne]", description: "Hébergeur" },
    { key: "legal.mediator", value: "[MÉDIATEUR DE LA CONSOMMATION À COMPLÉTER]", description: "Médiateur de la consommation (obligatoire avant vente)" },
    { key: "retention.children_days_after_event", value: 30, description: "Jours après l'évènement avant anonymisation des données des enfants" },
    { key: "retention.inactive_account_months", value: 36, description: "Mois d'inactivité avant suppression d'un compte" },
    { key: "retention.audit_logs_months", value: 12, description: "Conservation des journaux d'audit" },
    { key: "billing.live_enabled", value: false, description: "Paiement réel activé (nécessite validation juridique + clés live)" },
    { key: "sponsored.max_per_query", value: 2, description: "Nombre max de résultats sponsorisés par recherche" },
    { key: "moderation.require_review_on_major_update", value: true, description: "Re-modération des modifications importantes d'une page publiée" },
  ];
  for (const s of settings) {
    await db.insert(configurationSettings).values({ key: s.key, value: s.value, description: s.description }).onConflictDoNothing();
  }
}

/** Demo accounts, created through better-auth so password hashing and hooks are the real ones. */
export async function seedDemoUsers(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  for (const u of DEMO_USERS) {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, u.email)).limit(1);
    let id = existing?.id;
    if (!id) {
      const res = await auth.api.signUpEmail({ body: { email: u.email, password: DEMO_PASSWORD, name: u.name } });
      id = res.user.id;
    }
    await db.update(users).set({ role: u.role, emailVerified: true, isDemo: true }).where(eq(users.id, id));
    const [first, ...rest] = u.name.split(" ");
    await db
      .insert(userProfiles)
      .values({ userId: id, firstName: first ?? "", lastName: rest.join(" "), primaryIntent: u.intent, onboardingCompletedAt: ctx.now })
      .onConflictDoUpdate({ target: userProfiles.userId, set: { firstName: first ?? "", lastName: rest.join(" "), primaryIntent: u.intent, onboardingCompletedAt: ctx.now } });
    ctx.users[u.key] = id;
  }
}
