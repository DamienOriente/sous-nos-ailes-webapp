import { AppShell } from "@/components/layout/app-shell";
import { requireActor } from "@/lib/session";
import { countUnreadNotifications } from "@/modules/notifications/application/notification-service";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor("/app");
  const unread = await countUnreadNotifications(actor.userId);
  return (
    <AppShell actor={actor} unreadCount={unread}>
      {children}
    </AppShell>
  );
}
