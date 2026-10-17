"use client";
import { useRouter } from "next/navigation";
import { RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import type { ActionResult } from "@/lib/errors";
import { SYNC_DIRECTIONS, SYNC_DIRECTION_LABELS, type SyncDirection } from "@/modules/calendar/domain/constants";
import { ActionButton, ActionForm } from "@/components/childcare/action-form";

export type ConnectionView = {
  id: string;
  provider: "google" | "microsoft";
  label: string;
  externalAccountEmail: string | null;
  externalCalendarId: string | null;
  status: "active" | "expired" | "revoked" | "error";
  syncDirection: SyncDirection;
  lastSyncAt: string | null;
  lastError: string | null;
  calendars: Array<{ id: string; name: string; primary: boolean }>;
  recentJobs: Array<{ id: string; status: string; pushed: number; pulled: number; conflicts: number; error: string | null; createdAt: string }>;
};

const STATUS: Record<ConnectionView["status"], { label: string; tone: StatusTone }> = {
  active: { label: "Connecté", tone: "success" },
  expired: { label: "Jeton expiré — reconnectez", tone: "warning" },
  error: { label: "Erreur de synchronisation", tone: "danger" },
  revoked: { label: "Révoqué", tone: "neutral" },
};

export function ConnectionCard({
  connection: c,
  onUpdate,
  onSync,
  onDisconnect,
  reconnectHref,
}: {
  connection: ConnectionView;
  onUpdate: (fd: FormData) => Promise<ActionResult<unknown>>;
  onSync: () => Promise<ActionResult<{ pushed: number; pulled: number; conflicts: number }>>;
  onDisconnect: () => Promise<ActionResult<unknown>>;
  reconnectHref: string;
}) {
  const router = useRouter();
  const status = STATUS[c.status];
  const fmt = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  return (
    <Card className="gap-4 p-5" data-testid={`connection-${c.provider}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{c.label}</h3>
          <p className="text-sm text-muted-foreground">{c.externalAccountEmail ?? "Compte connecté"}</p>
        </div>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>
      {c.lastError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{c.lastError}</p>}
      {c.status === "expired" && (
        <Button asChild variant="outline" size="sm" className="w-fit">
          <a href={reconnectHref}>Reconnecter</a>
        </Button>
      )}

      <ActionForm action={onUpdate} submitLabel="Enregistrer les options" successMessage="Options enregistrées." className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`cal-${c.id}`}>Calendrier cible</Label>
          {c.calendars.length > 0 ? (
            <select id={`cal-${c.id}`} name="externalCalendarId" defaultValue={c.externalCalendarId ?? ""} className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
              {c.calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                  {cal.primary ? " (principal)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <input id={`cal-${c.id}`} name="externalCalendarId" defaultValue={c.externalCalendarId ?? "primary"} className="h-8 w-full rounded-lg border bg-background px-2 text-sm" aria-describedby={`cal-help-${c.id}`} />
          )}
          {c.calendars.length === 0 && (
            <p id={`cal-help-${c.id}`} className="text-xs text-muted-foreground">
              Liste indisponible (jeton expiré ou intégration non active) : identifiant du calendrier.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`dir-${c.id}`}>Direction</Label>
          <select id={`dir-${c.id}`} name="syncDirection" defaultValue={c.syncDirection} className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
            {SYNC_DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {SYNC_DIRECTION_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
      </ActionForm>

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <ActionButton
          action={async () => {
            const res = await onSync();
            if (res.ok) toast.success(`Synchronisé : ${res.data.pushed} envoyé(s), ${res.data.pulled} reçu(s), ${res.data.conflicts} conflit(s).`);
            return res;
          }}
          variant="default"
        >
          <RefreshCw className="size-4" aria-hidden="true" /> Synchroniser maintenant
        </ActionButton>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm" className="text-destructive">
              <Unplug className="size-4" aria-hidden="true" /> Déconnecter
            </Button>
          }
          title="Déconnecter ce calendrier ?"
          description="L'accès est révoqué chez le fournisseur quand c'est possible et les jetons sont supprimés. Les entrées déjà importées restent dans votre agenda."
          confirmLabel="Déconnecter"
          onConfirm={async () => {
            const res = await onDisconnect();
            if (res.ok) {
              toast.success("Calendrier déconnecté.");
              router.refresh();
            }
            return res;
          }}
        />
        <span className="ml-auto text-xs text-muted-foreground">{c.lastSyncAt ? `Dernière synchro : ${fmt(c.lastSyncAt)}` : "Jamais synchronisé"}</span>
      </div>

      {c.recentJobs.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Historique récent</summary>
          <ul className="mt-2 space-y-1 text-xs">
            {c.recentJobs.map((j) => (
              <li key={j.id} className="flex flex-wrap gap-2">
                <span className="tabular-nums text-muted-foreground">{fmt(j.createdAt)}</span>
                <StatusBadge tone={j.status === "succeeded" ? "success" : j.status === "failed" ? "danger" : "info"} dot={false}>
                  {j.status}
                </StatusBadge>
                <span>
                  ↑{j.pushed} ↓{j.pulled} ⚠{j.conflicts}
                </span>
                {j.error && <span className="text-destructive">{j.error}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
