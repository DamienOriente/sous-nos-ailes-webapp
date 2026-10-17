import { db } from "@/db/client";
import { notificationPreferences, userProfiles } from "@/db/schema";

/** Runs right after better-auth created a user row: application-side profile + default preferences. */
export async function onUserCreated(userId: string): Promise<void> {
  await db.insert(userProfiles).values({ userId }).onConflictDoNothing();
  await db.insert(notificationPreferences).values({ userId }).onConflictDoNothing();
}
