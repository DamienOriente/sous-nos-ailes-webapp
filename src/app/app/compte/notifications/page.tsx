import type { Metadata } from "next";
import { NotificationPreferencesForm } from "@/components/identity/notification-preferences-form";
import { requireActor } from "@/lib/session";
import { getNotificationPreferences } from "@/modules/identity/application/profile-service";

export const metadata: Metadata = { title: "Préférences de notification" };

export default async function NotificationPreferencesPage() {
  const actor = await requireActor("/app/compte/notifications");
  const prefs = await getNotificationPreferences(actor);
  return <NotificationPreferencesForm initial={prefs} />;
}
