import { eq } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { consentRecords, notificationPreferences, userProfiles, users } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { POLICY_VERSION } from "@/modules/identity/domain/auth";
import { normalizeTypeOverrides, type NotificationPreferencesInput } from "@/modules/identity/domain/notification-preferences";
import { DEFAULT_TIMEZONE, fullName, splitName, TIMEZONES, type PrimaryIntent, type ProfileInput, type Timezone } from "@/modules/identity/domain/profile";

export type ProfileView = {
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  city: string | null;
  postalCode: string | null;
  timezone: Timezone;
  locale: string;
  primaryIntent: PrimaryIntent | null;
  onboardingCompletedAt: Date | null;
};

/** Profile = better-auth user row + application profile row (created by the user hook; healed here if missing). */
export async function getProfile(actor: Actor, executor: DbExecutor = db): Promise<ProfileView> {
  const [row] = await executor
    .select({
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      timezone: users.timezone,
      locale: users.locale,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
      phone: userProfiles.phone,
      city: userProfiles.city,
      postalCode: userProfiles.postalCode,
      primaryIntent: userProfiles.primaryIntent,
      onboardingCompletedAt: userProfiles.onboardingCompletedAt,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, actor.userId))
    .limit(1);
  if (!row) throw new NotFoundError();

  // Older accounts (seed, admin-created) may only have `name`: derive the split for the form.
  const split = row.firstName || row.lastName ? { firstName: row.firstName ?? "", lastName: row.lastName ?? "" } : splitName(row.name);
  return {
    firstName: split.firstName,
    lastName: split.lastName,
    email: row.email,
    emailVerified: row.emailVerified,
    phone: row.phone ?? null,
    city: row.city ?? null,
    postalCode: row.postalCode ?? null,
    timezone: (TIMEZONES as readonly string[]).includes(row.timezone) ? (row.timezone as Timezone) : DEFAULT_TIMEZONE,
    locale: row.locale,
    primaryIntent: row.primaryIntent ?? null,
    onboardingCompletedAt: row.onboardingCompletedAt ?? null,
  };
}

export async function updateProfile(actor: Actor, input: ProfileInput, executor: DbExecutor = db): Promise<void> {
  await executor.transaction(async (tx) => {
    await tx
      .insert(userProfiles)
      .values({
        userId: actor.userId,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        city: input.city ?? null,
        postalCode: input.postalCode ?? null,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone ?? null,
          city: input.city ?? null,
          postalCode: input.postalCode ?? null,
          updatedAt: new Date(),
        },
      });
    await tx
      .update(users)
      .set({ name: fullName(input.firstName, input.lastName), timezone: input.timezone, locale: input.locale })
      .where(eq(users.id, actor.userId));
  });
}

/** Intent chosen during onboarding. Informational only: it never restricts the account. */
export async function setPrimaryIntent(actor: Actor, intent: PrimaryIntent, executor: DbExecutor = db): Promise<void> {
  await executor
    .insert(userProfiles)
    .values({ userId: actor.userId, primaryIntent: intent })
    .onConflictDoUpdate({ target: userProfiles.userId, set: { primaryIntent: intent, updatedAt: new Date() } });
}

export type ConsentContext = { ipAddress?: string | null; userAgent?: string | null };

/** Records the legal consents given at sign-up (terms + privacy policy) with the accepted policy version. */
export async function recordSignupConsents(userId: string, ctx: ConsentContext, executor: DbExecutor = db): Promise<void> {
  const purposes = ["terms", "privacy_policy"] as const;
  await executor.insert(consentRecords).values(
    purposes.map((purpose) => ({
      userId,
      purpose,
      granted: "granted" as const,
      policyVersion: POLICY_VERSION,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent?.slice(0, 512) ?? null,
    })),
  );
}

export type NotificationPreferencesView = NotificationPreferencesInput;

export async function getNotificationPreferences(actor: Actor, executor: DbExecutor = db): Promise<NotificationPreferencesView> {
  const [pref] = await executor.select().from(notificationPreferences).where(eq(notificationPreferences.userId, actor.userId)).limit(1);
  const digest = pref?.emailDigest === "daily" || pref?.emailDigest === "off" ? pref.emailDigest : "immediate";
  return {
    emailEnabled: pref?.emailEnabled ?? true,
    emailDigest: digest,
    types: (pref?.types as NotificationPreferencesInput["types"] | undefined) ?? {},
    marketingEmails: pref?.marketingEmails ?? false,
  };
}

/**
 * Marketing opt-in is a separate consent: any change is journalised in
 * consent_records so we can prove when it was granted or withdrawn.
 */
export async function updateNotificationPreferences(actor: Actor, input: NotificationPreferencesInput, ctx: ConsentContext, executor: DbExecutor = db): Promise<void> {
  await executor.transaction(async (tx) => {
    const [before] = await tx.select({ marketing: notificationPreferences.marketingEmails }).from(notificationPreferences).where(eq(notificationPreferences.userId, actor.userId)).limit(1);
    const types = normalizeTypeOverrides(input.types);
    await tx
      .insert(notificationPreferences)
      .values({ userId: actor.userId, emailEnabled: input.emailEnabled, emailDigest: input.emailDigest, types, marketingEmails: input.marketingEmails })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: { emailEnabled: input.emailEnabled, emailDigest: input.emailDigest, types, marketingEmails: input.marketingEmails, updatedAt: new Date() },
      });
    const previous = before?.marketing ?? false;
    if (previous !== input.marketingEmails) {
      await tx.insert(consentRecords).values({
        userId: actor.userId,
        purpose: "marketing_emails",
        granted: input.marketingEmails ? "granted" : "withdrawn",
        policyVersion: POLICY_VERSION,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent?.slice(0, 512) ?? null,
      });
      await tx.update(userProfiles).set({ marketingOptIn: input.marketingEmails }).where(eq(userProfiles.userId, actor.userId));
    }
  });
}

/** Called once right after sign-up: the better-auth row only knows `name`. */
export async function setSignupNames(userId: string, firstName: string, lastName: string, executor: DbExecutor = db): Promise<void> {
  await executor
    .insert(userProfiles)
    .values({ userId, firstName: firstName.trim(), lastName: lastName.trim() })
    .onConflictDoUpdate({ target: userProfiles.userId, set: { firstName: firstName.trim(), lastName: lastName.trim(), updatedAt: new Date() } });
}
