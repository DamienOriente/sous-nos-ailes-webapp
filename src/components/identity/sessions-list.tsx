"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { revokeOtherSessionsAction, revokeSessionAction } from "@/app/app/compte/securite/actions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/utils";
import { describeUserAgent, type SessionView } from "@/modules/identity/domain/security";

export function SessionsList({ sessions, timezone }: { sessions: SessionView[]; timezone: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const others = sessions.filter((s) => !s.isCurrent);

  function revoke(id: string) {
    start(async () => {
      const result = await revokeSessionAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Session déconnectée.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-xl border">
        {sessions.map((s) => {
          return (
            <li key={s.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {describeUserAgent(s.userAgent)}
                  {s.isCurrent && <StatusBadge tone="success">Cet appareil</StatusBadge>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {s.ipAddress ? `IP ${s.ipAddress} · ` : ""}
                  dernière activité {formatDateFr(s.updatedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, timezone)}
                </p>
              </div>
              {!s.isCurrent && (
                <Button variant="outline" size="sm" onClick={() => revoke(s.id)} disabled={pending} aria-label={`Déconnecter ${describeUserAgent(s.userAgent)}`}>
                  Déconnecter
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {others.length > 0 && (
        <ConfirmDialog
          trigger={
            <Button variant="outline" disabled={pending}>
              Déconnecter tous les autres appareils ({others.length})
            </Button>
          }
          title="Déconnecter les autres appareils ?"
          description="Toutes vos sessions sauf celle-ci seront fermées immédiatement. Vous devrez vous reconnecter sur ces appareils."
          confirmLabel="Tout déconnecter"
          onConfirm={async () => {
            const result = await revokeOtherSessionsAction();
            if (result.ok) router.refresh();
            return result;
          }}
          successMessage="Autres appareils déconnectés."
        />
      )}
    </div>
  );
}
