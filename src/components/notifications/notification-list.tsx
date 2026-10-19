"use client";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/modules/notifications/domain/types";
import { notificationLabel } from "./notification-label";

export type { NotificationItem };

type LoadMore = (offset: number) => Promise<ActionResult<{ items: NotificationItem[]; nextOffset: number | null }>>;

export function NotificationList({
  initialItems,
  initialNextOffset,
  loadMore,
  markRead,
}: {
  initialItems: NotificationItem[];
  initialNextOffset: number | null;
  loadMore: LoadMore;
  markRead: (id: string) => Promise<ActionResult<undefined>>;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [pending, start] = useTransition();

  const onOpen = (item: NotificationItem) => {
    if (!item.readAt) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)));
      start(async () => {
        const res = await markRead(item.id);
        if (!res.ok) toast.error(res.error);
        else if (!item.href) router.refresh();
      });
    }
    if (item.href) router.push(item.href);
  };

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-2xl border bg-card" data-testid="notification-list">
        {items.map((item) => {
          const unread = !item.readAt;
          return (
            <li key={item.id} data-testid="notification-item" data-unread={unread}>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", unread && "bg-primary/5")}
                aria-label={`${unread ? "Non lue : " : ""}${item.title}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>{item.title}</span>
                    <time dateTime={item.createdAt} className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: fr })}
                    </time>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{notificationLabel(item.type)}</span>
                  {item.body && <span className="mt-1 block text-sm text-muted-foreground text-pretty">{item.body}</span>}
                </span>
                {unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      {nextOffset !== null && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await loadMore(nextOffset);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                setItems((prev) => [...prev, ...res.data.items]);
                setNextOffset(res.data.nextOffset);
              })
            }
          >
            {pending ? "Chargement…" : "Charger plus"}
          </Button>
        </div>
      )}
    </div>
  );
}
