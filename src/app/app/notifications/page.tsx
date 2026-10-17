import Link from "next/link";
import { PageHeader } from "@/components/shared";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { NotificationEmptyState } from "@/components/notifications/notification-examples";
import { NotificationList } from "@/components/notifications/notification-list";
import { Button } from "@/components/ui/button";
import { requireActor } from "@/lib/session";
import { cn } from "@/lib/utils";
import { isNotificationType, listNotificationsPage, NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES, toNotificationItem } from "@/modules/notifications/application/notification-service";
import { loadMoreNotificationsAction, markAllNotificationsReadAction, markNotificationReadAction } from "./actions";

export const dynamic = "force-dynamic";

type Search = { type?: string; filtre?: string };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requireActor("/app/notifications");
  const sp = await searchParams;
  const type = sp.type && isNotificationType(sp.type) ? sp.type : undefined;
  const unreadOnly = sp.filtre === "non-lues";
  const page = await listNotificationsPage(actor.userId, { type, unreadOnly, limit: 20 });

  const usedTypes = NOTIFICATION_TYPES;
  const hrefFor = (t?: string, unread = unreadOnly) => {
    const q = new URLSearchParams();
    if (t) q.set("type", t);
    if (unread) q.set("filtre", "non-lues");
    const s = q.toString();
    return `/app/notifications${s ? `?${s}` : ""}`;
  };

  const markAll = markAllNotificationsReadAction.bind(null, type);
  const loadMore = loadMoreNotificationsAction.bind(null, { type, unreadOnly });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Centre de notifications"
        title="Notifications"
        description={page.unread > 0 ? `${page.unread} non lue${page.unread > 1 ? "s" : ""}` : "Vous êtes à jour."}
        actions={
          <>
            <Button asChild variant={unreadOnly ? "default" : "outline"} size="sm">
              <Link href={hrefFor(type, !unreadOnly)} aria-pressed={unreadOnly}>
                Non lues
              </Link>
            </Button>
            <MarkAllReadButton action={markAll} disabled={page.unread === 0} />
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/compte/notifications">Préférences</Link>
            </Button>
          </>
        }
      />

      <nav aria-label="Filtrer par type" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          <li>
            <Link href={hrefFor(undefined)} className={cn("inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium", !type ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")} aria-current={!type ? "page" : undefined}>
              Tout
            </Link>
          </li>
          {usedTypes.map((t) => (
            <li key={t}>
              <Link href={hrefFor(t)} className={cn("inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium", type === t ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")} aria-current={type === t ? "page" : undefined}>
                {NOTIFICATION_TYPE_LABELS[t]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {page.items.length === 0 ? (
        <NotificationEmptyState title={unreadOnly ? "Aucune notification non lue" : "Aucune notification"} description={type ? "Aucune notification de ce type pour le moment." : "Les invitations, messages et mises à jour de vos évènements apparaîtront ici, et par e-mail selon vos préférences."} />
      ) : (
        <NotificationList key={`${type ?? "all"}:${unreadOnly}`} initialItems={page.items.map(toNotificationItem)} initialNextOffset={page.nextOffset} loadMore={loadMore} markRead={markNotificationReadAction} />
      )}
    </div>
  );
}
