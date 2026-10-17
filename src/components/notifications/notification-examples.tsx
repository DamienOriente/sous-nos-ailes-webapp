import { InboxScene } from "@/components/illustrations/app-scenes";
import { NotificationIcon, notificationLabel } from "@/components/notifications/notification-icon";
import { cn } from "@/lib/utils";

/**
 * Illustrated empty state of the notification centre. The three cards are
 * examples of what will arrive, clearly labelled as such and inert (no link,
 * no read state): they never mix with real notifications.
 */
const EXAMPLES = [
  { type: "invitation_received", title: "Lisa vous invite à coorganiser « Mariage de Louis et Lisa »", body: "Accès au budget, aux invités et à la garde d'enfants." },
  { type: "inquiry_received", title: "Nouvelle demande : garde de 12 enfants le 12 juin", body: "Lisa D. — domaine d'Hélène, Lavaur. Répondre avec un devis." },
  { type: "profile_approved", title: "Votre fiche « Les Petites Ailes » est publiée", body: "Vérification : avis de situation SIRENE rapproché du SIRET déclaré." },
] as const;

export function NotificationEmptyState({ title, description, className }: { title: string; description: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-dashed bg-card/60", className)} role="status">
      <div className="grid gap-6 p-6 sm:grid-cols-[14rem_1fr] sm:items-center sm:p-8">
        <InboxScene className="mx-auto w-44 sm:w-full" />
        <div className="space-y-2">
          <h3 className="font-heading text-xl font-semibold">{title}</h3>
          <p className="max-w-md text-sm text-muted-foreground text-pretty">{description}</p>
        </div>
      </div>
      <div className="border-t bg-muted/30 p-4 sm:p-6">
        <p className="mb-3 text-xs font-medium text-muted-foreground">À quoi ressembleront vos notifications (exemples de démonstration)</p>
        <ul className="grid gap-2 lg:grid-cols-3" aria-label="Exemples de notifications">
          {EXAMPLES.map((n) => (
            <li key={n.type} className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5 opacity-90" data-testid="notification-example">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <NotificationIcon type={n.type} className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                  {notificationLabel(n.type)}
                  <span className="rounded-full bg-muted px-1.5 py-px font-medium">démo</span>
                </span>
                <span className="block text-sm font-medium leading-snug">{n.title}</span>
                <span className="block text-xs text-muted-foreground">{n.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
