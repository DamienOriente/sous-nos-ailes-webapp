import Link from "next/link";
import { InviteDialog } from "@/components/events/provider-forms";
import { LeaveEventButton, MemberRow, PendingInvitationRow } from "@/components/events/team-forms";
import { EmptyState, PageHeader } from "@/components/shared";
import { requireActor } from "@/lib/session";
import { cn, formatDateFr } from "@/lib/utils";
import { getCategoryOptions } from "@/modules/events/application/categories";
import { listEventAuditLogs, listMembers } from "@/modules/events/application/member-service";
import { listPendingInvitations } from "@/modules/events/application/provider-service";
import { guardPage } from "../_guards";
import { changeRoleAction, inviteCollaboratorAction, leaveEventAction, removePermissionAction, revokeInvitationAction, revokeMemberAction, setPermissionAction, transferOwnershipAction } from "./actions";

const AUDIT_LABELS: Record<string, string> = {
  "event.created": "Évènement créé",
  "event.status_changed": "Statut modifié",
  "event.deleted": "Évènement supprimé",
  "event.ownership_transferred": "Propriété transférée",
  "event.member.role_changed": "Rôle modifié",
  "event.member.revoked": "Accès révoqué",
  "event.member.left": "Membre parti",
  "event.member.joined": "Membre arrivé",
  "event.permission.set": "Permission explicite définie",
  "event.permission.removed": "Permission explicite retirée",
  "event.invitation.sent": "Invitation envoyée",
  "event.invitation.revoked": "Invitation révoquée",
  "event.provider.status_changed": "Statut prestataire modifié",
  "event.document.deleted": "Document supprimé",
  "event.channel.archived": "Canal archivé",
  "event.channel.restored": "Canal restauré",
};

export default async function TeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onglet?: string }> }) {
  const { id } = await params;
  const { onglet } = await searchParams;
  const actor = await requireActor(`/app/evenements/${id}/equipe`);
  const { access, members, ownerUserId } = await guardPage(() => listMembers(actor, id));
  const canManage = access.permissions.has("event.members.manage");
  const canPermissions = access.permissions.has("event.permissions.manage");
  const categories = canManage ? await getCategoryOptions() : [];
  const pending = canManage ? await listPendingInvitations(actor, id) : [];
  const journal = onglet === "journal" && access.isOrganizer ? await listEventAuditLogs(actor, id) : null;
  const base = `/app/evenements/${id}/equipe`;
  const active = members.filter((m) => m.status === "active");
  const inactive = members.filter((m) => m.status !== "active");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Équipe & permissions"
        description="Qui participe à l'évènement, avec quel rôle et quels droits. Chaque changement est journalisé et notifié."
        actions={canManage ? <InviteDialog eventId={id} defaultRole="collaborator" categories={categories} action={inviteCollaboratorAction} triggerLabel="Ajouter un collaborateur" /> : undefined}
      />
      {access.isOrganizer && (
        <div className="flex gap-1 border-b" role="tablist">
          <Link role="tab" aria-selected={onglet !== "journal"} href={base} className={cn("inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium", onglet !== "journal" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground")}>
             Membres
          </Link>
          <Link role="tab" aria-selected={onglet === "journal"} href={`${base}?onglet=journal`} className={cn("inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium", onglet === "journal" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground")}>
             Journal
          </Link>
        </div>
      )}

      {journal ? (
        journal.length === 0 ? (
          <EmptyState title="Journal vide" />
        ) : (
          <ol className="divide-y rounded-2xl border bg-card text-sm">
            {journal.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="font-medium">{AUDIT_LABELS[l.action] ?? l.action}</span>
                  <span className="ml-2 text-muted-foreground">par {l.actorName ?? "système"}</span>
                  {Object.keys(l.metadata).length > 0 && <span className="ml-2 text-xs text-muted-foreground">{Object.entries(l.metadata).filter(([, v]) => v !== null && typeof v !== "object").map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</span>}
                  {l.reason && <span className="ml-2 text-xs text-muted-foreground italic">« {l.reason} »</span>}
                </span>
                <time className="shrink-0 text-xs text-muted-foreground tabular-nums" dateTime={l.createdAt.toISOString()}>
                  {formatDateFr(l.createdAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </time>
              </li>
            ))}
          </ol>
        )
      ) : (
        <>
          <section aria-labelledby="active" className="space-y-3">
            <h2 id="active" className="text-sm font-semibold text-muted-foreground">
              Membres actifs ({active.length})
            </h2>
            <ul className="divide-y rounded-2xl border bg-card">
              {active.map((m) => (
                <MemberRow
                  key={m.id}
                  eventId={id}
                  member={m}
                  isOwnerRow={m.userId === ownerUserId}
                  viewer={{ isOwner: access.role === "owner", canManage, canPermissions, memberId: access.memberId }}
                  categories={categories}
                  actions={{ changeRole: changeRoleAction, revoke: revokeMemberAction, transfer: transferOwnershipAction, setPermission: setPermissionAction, removePermission: removePermissionAction }}
                />
              ))}
            </ul>
          </section>
          {pending.length > 0 && (
            <section aria-labelledby="pending" className="space-y-3">
              <h2 id="pending" className="text-sm font-semibold text-muted-foreground">
                Invitations en attente ({pending.length})
              </h2>
              <ul className="divide-y rounded-2xl border bg-card">
                {pending.map((p) => (
                  <PendingInvitationRow key={p.id} eventId={id} invitation={{ id: p.id, recipientName: p.recipientName, recipientEmail: p.recipientEmail, targetRole: p.targetRole, sentAt: p.sentAt?.toISOString() ?? null, expiresAt: p.expiresAt?.toISOString() ?? null }} action={revokeInvitationAction} />
                ))}
              </ul>
            </section>
          )}
          {inactive.length > 0 && canManage && (
            <section aria-labelledby="inactive" className="space-y-3">
              <h2 id="inactive" className="text-sm font-semibold text-muted-foreground">
                Anciens membres ({inactive.length})
              </h2>
              <ul className="divide-y rounded-2xl border bg-card text-sm">
                {inactive.map((m) => (
                  <li key={m.id} className="flex items-center justify-between px-4 py-2 text-muted-foreground">
                    <span>{m.name}</span>
                    <span className="text-xs">
                      {m.status === "revoked" ? "Révoqué" : "Parti"} {m.revokedAt ? `le ${formatDateFr(m.revokedAt)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {access.role !== "owner" && (
            <div className="flex justify-end">
              <LeaveEventButton eventId={id} action={leaveEventAction} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
