import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { dateTime } from "@/components/admin/admin-table";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NotFoundError } from "@/lib/errors";
import { canGlobal } from "@/modules/authorization";
import { getUserDetail } from "@/modules/admin/application/user-admin";
import { STATUS_LABELS, STATUS_TONES, type ProfessionalStatus } from "@/modules/professionals/domain/status";
import { requireAdminPage } from "../../_lib/admin-page";
import { reactivateUserAction, revokeSessionAction, revokeUserSessionsAction, setRoleAction, suspendUserAction } from "../actions";

export const dynamic = "force-dynamic";

function revokeAllFormData(userId: string): FormData {
  const fd = new FormData();
  fd.set("userId", userId);
  fd.set("reason", "Révocation de toutes les sessions par un administrateur");
  return fd;
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, twoFactorWarning } = await requireAdminPage("admin.users.view", `/admin/utilisateurs/${id}`);
  let d;
  try {
    d = await getUserDetail(actor, id, { headers: await headers() });
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const canManage = canGlobal(actor, "admin.users.manage");
  const canRoles = canGlobal(actor, "admin.roles.manage");
  const u = d.user;
  const revokeAll = revokeUserSessionsAction.bind(null, revokeAllFormData(u.id));
  return (
    <div className="space-y-6">
      <Link href="/admin/utilisateurs" className="text-sm text-muted-foreground hover:underline">Retour aux utilisateurs</Link>
      <PageHeader
        title={u.name}
        description={u.email}
        actions={
          <>
            <StatusBadge tone={u.role === "user" ? "neutral" : "primary"} dot={false}>{u.role}</StatusBadge>
            {u.banned ? <StatusBadge tone="danger">Suspendu</StatusBadge> : <StatusBadge tone="success">Actif</StatusBadge>}
            {u.isDemo && <StatusBadge tone="neutral">démo</StatusBadge>}
          </>
        }
      />
      <TwoFactorBanner show={twoFactorWarning} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="gap-3 p-6">
            <h2 className="font-semibold">Compte</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">E-mail vérifié</dt><dd>{u.emailVerified ? "Oui" : "Non"}</dd></div>
              <div><dt className="text-muted-foreground">Double authentification</dt><dd>{u.twoFactorEnabled ? "Activée" : "Non activée"}</dd></div>
              <div><dt className="text-muted-foreground">Inscrit le</dt><dd>{dateTime(u.createdAt)}</dd></div>
              <div><dt className="text-muted-foreground">Dernière connexion</dt><dd>{dateTime(u.lastLoginAt)}</dd></div>
              <div><dt className="text-muted-foreground">Intention</dt><dd>{d.profile?.primaryIntent ?? "Non renseignée"}</dd></div>
              <div><dt className="text-muted-foreground">Fuseau / langue</dt><dd>{u.timezone} · {u.locale}</dd></div>
              {u.banned && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Suspension</dt>
                  <dd>{u.banReason ?? "Non renseigné"}{u.banExpires ? ` (jusqu'au ${dateTime(u.banExpires)})` : " (indéfinie)"}</dd>
                </div>
              )}
            </dl>
          </Card>
          <Card className="gap-3 p-6">
            <h2 className="font-semibold">Fiches professionnelles ({d.listings.length})</h2>
            {d.listings.length === 0 ? <p className="text-sm text-muted-foreground">Aucune.</p> : (
              <ul className="space-y-1 text-sm">
                {d.listings.map((l) => (
                  <li key={l.id} className="flex items-center justify-between">
                    <Link href={`/admin/professionnels/${l.id}`} className="underline">{l.displayName}</Link>
                    <StatusBadge tone={STATUS_TONES[l.status as ProfessionalStatus]}>{STATUS_LABELS[l.status as ProfessionalStatus]}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="gap-3 p-6">
            <h2 className="font-semibold">Évènements ({d.events.length})</h2>
            <p className="text-xs text-muted-foreground">Noms et rôles uniquement : le contenu des évènements (invités, enfants, messages) n'est pas accessible à l'administration.</p>
            {d.events.length === 0 ? <p className="text-sm text-muted-foreground">Aucun.</p> : (
              <ul className="space-y-1 text-sm">
                {d.events.map((e) => (
                  <li key={e.id} className="flex justify-between"><span>{e.name}</span><span className="text-muted-foreground">{e.role} · {e.status}</span></li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="gap-3 p-6">
            <h2 className="font-semibold">Sessions actives ({d.sessions.length})</h2>
            {d.sessions.length === 0 ? <p className="text-sm text-muted-foreground">Aucune session.</p> : (
              <ul className="divide-y text-sm">
                {d.sessions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="truncate text-muted-foreground">{s.ipAddress ?? "ip ?"} · {s.userAgent?.slice(0, 60) ?? "agent ?"} · expire {dateTime(s.expiresAt)}</span>
                    {canManage && (
                      <ActionForm action={revokeSessionAction} successMessage="Session révoquée." className="space-y-0">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="sessionId" value={s.id} />
                        <ActionSubmit size="sm" variant="outline">Révoquer</ActionSubmit>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canManage && d.sessions.length > 0 && (
              <ConfirmDialog trigger={<Button variant="outline" size="sm">Révoquer toutes les sessions</Button>} title="Révoquer toutes les sessions ?" description="L'utilisateur sera déconnecté de tous ses appareils." confirmLabel="Révoquer" onConfirm={revokeAll} successMessage="Sessions révoquées." />
            )}
          </Card>
          <Card className="gap-3 p-6">
            <h2 className="font-semibold">Modération et recours</h2>
            {d.moderation.length === 0 && d.appeals.length === 0 ? <p className="text-sm text-muted-foreground">Aucun historique de modération.</p> : (
              <ul className="divide-y text-sm">
                {d.moderation.map((m, i) => (
                  <li key={`${m.caseId}-${i}`} className="py-2">
                    <Link href={`/admin/moderation/${m.caseId}`} className="underline">{m.kind}</Link> · {m.status}
                    {m.decision && <span className="text-muted-foreground"> · {m.decision} : {m.reason}</span>}
                  </li>
                ))}
                {d.appeals.map((a) => (
                  <li key={a.id} className="py-2">Recours ({a.status}) · {dateTime(a.createdAt)} : {a.argument.slice(0, 120)}</li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="gap-3 p-6">
            <h2 className="font-semibold">Journal d'audit (50 derniers)</h2>
            {d.audit.length === 0 ? <p className="text-sm text-muted-foreground">Aucune entrée.</p> : (
              <ul className="divide-y text-sm">
                {d.audit.map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                    <span><code className="text-xs">{a.action}</code> {a.resourceType}{a.reason ? ` : ${a.reason}` : ""}</span>
                    <span className="text-muted-foreground">{dateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          {canManage && (
            <Card className="gap-3 p-6">
              <h2 className="font-semibold">{u.banned ? "Réactiver" : "Suspendre"}</h2>
              {u.banned ? (
                <ActionForm action={reactivateUserAction} successMessage="Compte réactivé.">
                  <input type="hidden" name="userId" value={u.id} />
                  <Label htmlFor="react-reason">Motif</Label>
                  <Input id="react-reason" name="reason" required minLength={5} />
                  <ActionSubmit>Réactiver le compte</ActionSubmit>
                </ActionForm>
              ) : (
                <ActionForm action={suspendUserAction} successMessage="Compte suspendu.">
                  <input type="hidden" name="userId" value={u.id} />
                  <Label htmlFor="susp-reason">Motif (obligatoire)</Label>
                  <Textarea id="susp-reason" name="reason" required minLength={10} rows={3} />
                  <Label htmlFor="susp-days">Durée en jours (vide = indéfinie)</Label>
                  <Input id="susp-days" name="durationDays" type="number" min={0} max={3650} />
                  <ActionSubmit variant="destructive">Suspendre</ActionSubmit>
                </ActionForm>
              )}
              <p className="text-xs text-muted-foreground">La suspension révoque les sessions et bloque la connexion. Action journalisée.</p>
            </Card>
          )}
          <Card className="gap-3 p-6">
            <h2 className="font-semibold">Rôle global</h2>
            {canRoles ? (
              <ActionForm action={setRoleAction} successMessage="Rôle mis à jour.">
                <input type="hidden" name="userId" value={u.id} />
                <select name="role" defaultValue={u.role} className="h-9 w-full rounded-md border bg-background px-2 text-sm" aria-label="Rôle">
                  <option value="user">user</option>
                  <option value="moderator">moderator</option>
                  <option value="admin">admin</option>
                </select>
                <Input name="reason" required minLength={5} placeholder="Motif" aria-label="Motif" />
                <ActionSubmit variant="outline">Changer le rôle</ActionSubmit>
                <p className="text-xs text-muted-foreground">La promotion en super_admin se fait hors interface ; le dernier super_admin ne peut pas être rétrogradé.</p>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted-foreground">Réservé aux super administrateurs.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
