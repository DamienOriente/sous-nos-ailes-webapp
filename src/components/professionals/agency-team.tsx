import { ActionForm, FieldErrorText, type FormAction } from "@/components/professionals/action-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ActionResult } from "@/lib/errors";
import { formatDateFr } from "@/lib/utils";
import type { OrganizationTeam } from "@/modules/professionals/application/member-service";
import { INVITABLE_ROLES, ORGANIZATION_INVITATION_TTL_DAYS, ORGANIZATION_ROLE_DESCRIPTIONS, ORGANIZATION_ROLE_LABELS } from "@/modules/professionals/domain/members";

type Actions = {
  invite: FormAction;
  changeRole: FormAction;
  remove: (organizationId: string, memberId: string) => Promise<ActionResult<undefined>>;
  revoke: (organizationId: string, invitationId: string) => Promise<ActionResult<undefined>>;
};

const SELECT_CLASS = "h-9 rounded-lg border bg-background px-3 text-sm";

/** Agency team: members, pending invitations and the invite form (owner and admins only). */
export function AgencyTeam({ team, actorUserId, actions }: { team: OrganizationTeam; actorUserId: string; actions: Actions }) {
  const { organizationId } = team;
  return (
    <Card className="gap-6 p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="font-heading text-lg font-semibold">
          Équipe de {team.name}
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Les membres gèrent les fiches de l&apos;agence avec leur propre compte. L&apos;abonnement agence reste au nom du propriétaire : lui seul peut l&apos;ouvrir ou y ajouter une fiche payante.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membre</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Depuis le</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <span className="font-medium">{m.name}</span>
                  {m.userId === actorUserId && <span className="text-muted-foreground"> (vous)</span>}
                  <span className="block text-sm text-muted-foreground">{m.email}</span>
                </TableCell>
                <TableCell>
                  {m.editable ? (
                    <ActionForm action={actions.changeRole} hideSubmit successMessage="Rôle modifié.">
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="memberId" value={m.id} />
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={`role-${m.id}`} className="sr-only">
                          Rôle de {m.name}
                        </label>
                        <select id={`role-${m.id}`} name="role" defaultValue={m.role} className={SELECT_CLASS}>
                          {INVITABLE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ORGANIZATION_ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" variant="outline" size="sm">
                          Changer le rôle
                        </Button>
                      </div>
                    </ActionForm>
                  ) : (
                    ORGANIZATION_ROLE_LABELS[m.role]
                  )}
                </TableCell>
                <TableCell className="text-sm tabular-nums">{m.acceptedAt ? formatDateFr(m.acceptedAt) : "n/d"}</TableCell>
                <TableCell className="text-right">
                  {m.editable && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="outline" size="sm">
                          {m.userId === actorUserId ? "Quitter l'équipe" : "Retirer"}
                          <span className="sr-only"> {m.name}</span>
                        </Button>
                      }
                      title={m.userId === actorUserId ? "Quitter l'équipe ?" : `Retirer ${m.name} de l'équipe ?`}
                      description={
                        m.userId === actorUserId
                          ? "Vous n'aurez plus accès aux fiches de l'agence. Il faudra une nouvelle invitation pour revenir."
                          : "Cette personne n'aura plus accès aux fiches de l'agence. Les modifications déjà faites sont conservées."
                      }
                      confirmLabel={m.userId === actorUserId ? "Quitter" : "Retirer"}
                      onConfirm={actions.remove.bind(null, organizationId, m.id)}
                      successMessage={m.userId === actorUserId ? "Vous avez quitté l'équipe." : "Membre retiré."}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {team.invitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading text-base font-semibold">Invitations en attente</h3>
          <ul className="divide-y rounded-xl border">
            {team.invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <span className="font-medium">{i.email}</span>
                  <span className="block text-muted-foreground">
                    {ORGANIZATION_ROLE_LABELS[i.role]}, lien valable jusqu&apos;au {formatDateFr(i.expiresAt)}
                    {i.invitedByName ? `, envoyée par ${i.invitedByName}` : ""}
                  </span>
                </div>
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" size="sm">
                      Annuler l&apos;invitation<span className="sr-only"> de {i.email}</span>
                    </Button>
                  }
                  title="Annuler cette invitation ?"
                  description={`Le lien envoyé à ${i.email} ne fonctionnera plus.`}
                  confirmLabel="Annuler l'invitation"
                  onConfirm={actions.revoke.bind(null, organizationId, i.id)}
                  successMessage="Invitation annulée."
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-heading text-base font-semibold">Inviter une personne</h3>
        <ActionForm action={actions.invite} submitLabel="Envoyer l'invitation" pendingLabel="Envoi…" successMessage="Invitation envoyée par e-mail.">
          <input type="hidden" name="organizationId" value={organizationId} />
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`invite-email-${organizationId}`}>Adresse e-mail</Label>
              <Input id={`invite-email-${organizationId}`} name="email" type="email" required autoComplete="off" />
              <FieldErrorText name="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`invite-role-${organizationId}`}>Rôle</Label>
              <select id={`invite-role-${organizationId}`} name="role" required defaultValue="manager" className={`${SELECT_CLASS} w-full`}>
                {INVITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ORGANIZATION_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <FieldErrorText name="role" />
            </div>
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]">
            {INVITABLE_ROLES.map((r) => (
              <div key={r} className="contents">
                <dt className="font-medium">{ORGANIZATION_ROLE_LABELS[r]}</dt>
                <dd className="text-muted-foreground">{ORGANIZATION_ROLE_DESCRIPTIONS[r]}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted-foreground text-pretty">
            La personne reçoit un lien personnel, utilisable une fois et valable {ORGANIZATION_INVITATION_TTL_DAYS} jours. Elle l&apos;accepte avec un compte ouvert à cette adresse e-mail.
          </p>
        </ActionForm>
      </div>
    </Card>
  );
}
