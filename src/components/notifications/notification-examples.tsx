import { InboxScene } from "@/components/illustrations/app-scenes";
import { notificationLabel } from "@/components/notifications/notification-label";
import { cn } from "@/lib/utils";

/**
 * Illustrated empty state of the notification centre. The three cards are
 * examples of what will arrive, clearly labelled as such and inert (no link,
 * no read state): they never mix with real notifications.
 */
const EXAMPLES = [
  { type: "invitation_received", title: "Lisa vous invite à coorganiser « Mariage de Louis et Lisa »", body: "Accès au budget, aux invités et à la garde d'enfants." },
  { type: "inquiry_received", title: "Nouvelle demande : garde de 12 enfants le 12 juin", body: "Lisa D., domaine d'Hélène à Lavaur. Répondre avec un devis." },
  { type: "profile_approved", title: "Votre fiche « Les Petites Ailes » est publiée", body: "Vérification : avis de situation SIRENE rapproché du SIRET déclaré." },
] as const;

export function NotificationEmptyState({ title, description, className }: { title: string; description: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-dashed bg-card", className)} role="status">
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
            <li key={n.type} className="rounded-xl border bg-card px-3 py-2.5" data-testid="notification-example">
              <span className="block text-[11px] text-muted-foreground">{notificationLabel(n.type)} · exemple</span>
              <span className="block text-sm font-medium leading-snug">{n.title}</span>
              <span className="block text-xs text-muted-foreground">{n.body}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
