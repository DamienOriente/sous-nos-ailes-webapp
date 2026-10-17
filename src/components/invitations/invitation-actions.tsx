"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, BellRing, Link2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { ActionResult } from "@/lib/errors";
import type { InvitationStatus } from "@/modules/invitations/domain/state";

export function InvitationActions({
  eventId,
  invitationId,
  status,
  hasEmail,
  reminderCount,
  onSend,
  onRemind,
  onRevoke,
  onDelete,
  onCopyLink,
}: {
  eventId: string;
  invitationId: string;
  status: InvitationStatus;
  hasEmail: boolean;
  reminderCount: number;
  onSend: (eventId: string, id: string) => Promise<ActionResult>;
  onRemind: (eventId: string, id: string) => Promise<ActionResult>;
  onRevoke: (eventId: string, id: string) => Promise<ActionResult>;
  onDelete: (eventId: string, id: string) => Promise<ActionResult>;
  onCopyLink: (eventId: string, id: string) => Promise<ActionResult<{ url: string }>>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, success: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else toast.error(res.error);
    });
  const terminal = status === "revoked" || status === "expired";
  return (
    <div className="flex flex-wrap gap-2">
      {!terminal && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await onCopyLink(eventId, invitationId);
              if (!res.ok) return void toast.error(res.error);
              try {
                await navigator.clipboard.writeText(res.data.url);
                toast.success("Lien RSVP copié.");
              } catch {
                window.prompt("Copiez le lien RSVP :", res.data.url);
              }
            })
          }
        >
          <Link2 className="size-4" aria-hidden="true" /> Copier le lien RSVP
        </Button>
      )}
      {status === "draft" && (
        <Button size="sm" disabled={pending || !hasEmail} title={hasEmail ? undefined : "Ajoutez un e-mail pour envoyer"} onClick={() => run(() => onSend(eventId, invitationId), "Invitation envoyée (e-mail en file d'attente).")}>
          <Send className="size-4" aria-hidden="true" /> Envoyer par e-mail
        </Button>
      )}
      {(status === "sent" || status === "viewed") && hasEmail && (
        <Button variant="outline" size="sm" disabled={pending || reminderCount >= 2} onClick={() => run(() => onRemind(eventId, invitationId), "Relance envoyée.")}>
          <BellRing className="size-4" aria-hidden="true" /> Relancer ({reminderCount}/2)
        </Button>
      )}
      {!terminal && (
        <ConfirmDialog
          title="Révoquer cette invitation ?"
          description="Le lien RSVP et le QR code deviennent immédiatement inutilisables. L'action est journalisée."
          confirmLabel="Révoquer"
          successMessage="Invitation révoquée."
          onConfirm={async () => {
            const res = await onRevoke(eventId, invitationId);
            if (res.ok) router.refresh();
            return res;
          }}
          trigger={
            <Button variant="destructive" size="sm">
              <Ban className="size-4" aria-hidden="true" /> Révoquer
            </Button>
          }
        />
      )}
      <ConfirmDialog
        title="Supprimer cette invitation ?"
        description="Suppression définitive de l'invitation, de ses liens et de son historique de réponses."
        confirmLabel="Supprimer"
        onConfirm={async () => {
          const res = await onDelete(eventId, invitationId);
          if (res.ok) {
            toast.success("Invitation supprimée.");
            router.push(`/app/evenements/${eventId}/invitations`);
            router.refresh();
          }
          return res;
        }}
        trigger={
          <Button variant="ghost" size="sm">
            <Trash2 className="size-4" aria-hidden="true" /> Supprimer
          </Button>
        }
      />
    </div>
  );
}
