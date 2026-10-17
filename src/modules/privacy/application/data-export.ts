import { and, desc, eq, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { consentRecords, contacts, dataSubjectRequests, events, notificationPreferences, plans, professionals, subscriptions, userProfiles, users, auditLogs } from "@/db/schema";
import type { Actor } from "@/lib/session";

/**
 * Right of access / portability (art. 15 & 20). The export contains the
 * person's own data only: profile, the events they own (metadata, not the
 * guests nor the children registered inside), the listings they own, their
 * address book, consents, requests and subscription status. It never includes
 * other people's accounts, messages written by others, or any child health data.
 */
export type UserDataExport = {
  format: "sous-nos-ailes/user-export";
  version: 1;
  generatedAt: string;
  scope: string[];
  excluded: string[];
  account: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  notificationPreferences: Record<string, unknown> | null;
  events: Array<Record<string, unknown>>;
  professionals: Array<Record<string, unknown>>;
  contacts: Array<Record<string, unknown>>;
  subscriptions: Array<Record<string, unknown>>;
  consents: Array<Record<string, unknown>>;
  dataSubjectRequests: Array<Record<string, unknown>>;
};

export const EXPORT_EXCLUDED = [
  "Données des autres personnes (invités, membres, autres comptes)",
  "Données des enfants enregistrés dans vos évènements et toute donnée de santé",
  "Messages rédigés par d'autres personnes",
  "Documents déposés (téléchargeables depuis chaque évènement ou fiche)",
  "Journaux techniques et de sécurité",
];

export async function exportUserData(actor: Actor, executor: DbExecutor = db): Promise<UserDataExport> {
  const userId = actor.userId;
  const [account] = await executor
    .select({ id: users.id, name: users.name, email: users.email, emailVerified: users.emailVerified, locale: users.locale, timezone: users.timezone, twoFactorEnabled: users.twoFactorEnabled, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const [profile] = await executor
    .select({ firstName: userProfiles.firstName, lastName: userProfiles.lastName, phone: userProfiles.phone, city: userProfiles.city, postalCode: userProfiles.postalCode, primaryIntent: userProfiles.primaryIntent, marketingOptIn: userProfiles.marketingOptIn, onboardingCompletedAt: userProfiles.onboardingCompletedAt })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  const [prefs] = await executor
    .select({ emailEnabled: notificationPreferences.emailEnabled, emailDigest: notificationPreferences.emailDigest, types: notificationPreferences.types, marketingEmails: notificationPreferences.marketingEmails })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  const ownedEvents = await executor
    .select({ id: events.id, name: events.name, type: events.type, status: events.status, eventDate: events.eventDate, city: events.city, department: events.department, expectedGuests: events.expectedGuests, expectedChildren: events.expectedChildren, budgetCents: events.budgetCents, createdAt: events.createdAt })
    .from(events)
    .where(and(eq(events.ownerUserId, userId), isNull(events.deletedAt)));
  const ownedPros = await executor
    .select({ id: professionals.id, slug: professionals.slug, displayName: professionals.displayName, tagline: professionals.tagline, description: professionals.description, status: professionals.status, city: professionals.city, department: professionals.department, priceFromCents: professionals.priceFromCents, priceToCents: professionals.priceToCents, publicEmail: professionals.publicEmail, publicPhone: professionals.publicPhone, website: professionals.website, verificationLevel: professionals.verificationLevel, createdAt: professionals.createdAt })
    .from(professionals)
    .where(and(eq(professionals.ownerUserId, userId), isNull(professionals.deletedAt)));
  const book = await executor
    .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, company: contacts.company, email: contacts.email, phone: contacts.phone, category: contacts.category, tags: contacts.tags, notes: contacts.notes, createdAt: contacts.createdAt })
    .from(contacts)
    .where(eq(contacts.ownerUserId, userId));
  const subs = await executor
    .select({ planKey: plans.key, planName: plans.name, status: subscriptions.status, provider: subscriptions.provider, currentPeriodEnd: subscriptions.currentPeriodEnd, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd, createdAt: subscriptions.createdAt })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.userId, userId));
  const consents = await executor
    .select({ purpose: consentRecords.purpose, granted: consentRecords.granted, policyVersion: consentRecords.policyVersion, createdAt: consentRecords.createdAt })
    .from(consentRecords)
    .where(eq(consentRecords.userId, userId))
    .orderBy(desc(consentRecords.createdAt));
  const requests = await executor
    .select({ kind: dataSubjectRequests.kind, status: dataSubjectRequests.status, details: dataSubjectRequests.details, dueAt: dataSubjectRequests.dueAt, completedAt: dataSubjectRequests.completedAt, createdAt: dataSubjectRequests.createdAt })
    .from(dataSubjectRequests)
    .where(eq(dataSubjectRequests.userId, userId));

  await executor.insert(auditLogs).values({ actorUserId: userId, action: "privacy.export.generated", resourceType: "user", resourceId: userId, metadata: { events: ownedEvents.length, professionals: ownedPros.length } });

  return {
    format: "sous-nos-ailes/user-export",
    version: 1,
    generatedAt: new Date().toISOString(),
    scope: ["account", "profile", "notificationPreferences", "events (métadonnées des évènements dont vous êtes propriétaire)", "professionals (fiches dont vous êtes propriétaire)", "contacts (votre carnet)", "subscriptions", "consents", "dataSubjectRequests"],
    excluded: EXPORT_EXCLUDED,
    account: account ?? {},
    profile: profile ?? null,
    notificationPreferences: prefs ?? null,
    events: ownedEvents,
    professionals: ownedPros,
    contacts: book,
    subscriptions: subs,
    consents,
    dataSubjectRequests: requests,
  };
}
