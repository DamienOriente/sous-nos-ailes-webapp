import { ShieldAlert } from "lucide-react";
import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { AdminTable, dateTime } from "@/components/admin/admin-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BREAK_GLASS_GRANTABLE, BREAK_GLASS_MAX_MINUTES, listBreakGlassGrants } from "@/modules/admin/application/break-glass";
import { requireAdminPage } from "../../_lib/admin-page";
import { grantBreakGlassAction, revokeBreakGlassAction } from "../actions";
import { SecuritySubnav } from "../page";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  "event.view": "Voir l'évènement",
  "event.members.view": "Voir l'équipe",
  "event.guests.view": "Voir les invités",
  "event.documents.view": "Voir les documents",
  "event.channels.view_all": "Lire tous les canaux de messages",
  "children.view_roster": "Voir la liste des enfants",
  "children.view_sensitive": "Voir les données de santé des enfants (journalisé)",
  "children.view_access_logs": "Voir le journal d'accès aux données enfants",
};

export default async function BreakGlassPage() {
  const { actor } = await requireAdminPage("admin.break_glass", "/admin/securite/break-glass");
  const grants = await listBreakGlassGrants(actor);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Sécurité" title="Accès exceptionnel (break-glass)" description="Réservé aux super administrateurs. Accès temporaire et explicite à un évènement pour une demande légale ou un incident de sécurité. Le propriétaire de l'évènement est prévenu ; tout est journalisé." />
      <SecuritySubnav current="/admin/securite/break-glass" showBreakGlass />
      <Card className="gap-4 border-destructive/40 p-6">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4 text-destructive" aria-hidden="true" /> Nouvel accès exceptionnel</h2>
        <ActionForm action={grantBreakGlassAction} successMessage="Accès accordé. Le propriétaire a été notifié." resetOnSuccess className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="eventId">Identifiant de l'évènement (UUID)</Label>
              <Input id="eventId" name="eventId" required pattern="[0-9a-fA-F-]{36}" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="durationMinutes">Durée (minutes, max {BREAK_GLASS_MAX_MINUTES})</Label>
              <Input id="durationMinutes" name="durationMinutes" type="number" min={5} max={BREAK_GLASS_MAX_MINUTES} defaultValue={60} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="legalReason">Motif juridique (obligatoire, conservé dans l'audit)</Label>
            <Textarea id="legalReason" name="legalReason" required minLength={20} rows={3} placeholder="Ex. : réquisition judiciaire n° … reçue le …, portant sur …" />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Droits accordés (le minimum nécessaire)</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {BREAK_GLASS_GRANTABLE.map((g) => (
                <label key={g} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="grants" value={g} defaultChecked={g === "event.view"} /> {LABELS[g] ?? g}
                </label>
              ))}
            </div>
          </fieldset>
          <ActionSubmit variant="destructive">Accorder l'accès exceptionnel</ActionSubmit>
        </ActionForm>
      </Card>
      <AdminTable
        rows={grants}
        rowKey={(r) => r.memberId}
        emptyTitle="Aucun accès exceptionnel"
        columns={[
          { key: "event", header: "Évènement", cell: (r) => (<div><span className="font-medium">{r.eventName}</span><p className="text-xs text-muted-foreground">{r.eventId}</p></div>) },
          { key: "user", header: "Compte", cell: (r) => <code className="text-xs">{r.userId.slice(0, 10)}…</code> },
          { key: "status", header: "Statut", cell: (r) => (r.status === "active" ? <StatusBadge tone="danger">actif</StatusBadge> : <StatusBadge tone="neutral">révoqué {r.revokedAt ? dateTime(r.revokedAt) : ""}</StatusBadge>) },
          { key: "expires", header: "Expire", cell: (r) => <span className="text-muted-foreground">{r.expiresAt ? dateTime(r.expiresAt) : "—"}</span> },
          { key: "granted", header: "Accordé le", cell: (r) => <span className="text-muted-foreground">{dateTime(r.joinedAt)}</span> },
          {
            key: "actions",
            header: "",
            cell: (r) =>
              r.status === "active" ? (
                <ActionForm action={revokeBreakGlassAction} successMessage="Accès révoqué." className="space-y-0">
                  <input type="hidden" name="memberId" value={r.memberId} />
                  <ActionSubmit size="sm" variant="outline">Révoquer maintenant</ActionSubmit>
                </ActionForm>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
