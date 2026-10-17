import Link from "next/link";
import { ArrowLeft, Copy, LogIn, Pencil, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ActionButton, ActionDialog } from "@/components/childcare/action-form";
import { ChildFormFields } from "@/components/childcare/child-form-fields";
import { HandoverWizard } from "@/components/childcare/handover-wizard";
import { PRESENCE_LABELS } from "@/components/childcare/roster-table";
import { SensitivePanel } from "@/components/childcare/sensitive-panel";
import { requireActor } from "@/lib/session";
import { getUserTimezone } from "@/modules/calendar/application/calendar-service";
import { formatDateTime } from "@/modules/calendar/domain/datetime";
import { listHandovers } from "@/modules/childcare/application/attendance-service";
import { getChildDetail } from "@/modules/childcare/application/children-service";
import { guardPage } from "@/components/childcare/page-guard";
import { GUARDIAN_INFORMATION_TEXT } from "@/modules/childcare/domain/rules";
import {
  addAuthorizedPersonAction,
  addEmergencyContactAction,
  deleteChildAction,
  handoverAction,
  markGuardianInformedAction,
  quickAttendanceAction,
  readSensitiveAction,
  recordAttendanceAction,
  removeAuthorizedPersonAction,
  removeEmergencyContactAction,
  setSensitiveAction,
  updateChildAction,
  withdrawConsentAction,
} from "../actions";

const ATTENDANCE_LABELS: Record<string, string> = { check_in: "Arrivée", check_out: "Départ", incident: "Incident", note: "Note" };

export default async function ChildDetailPage({ params }: { params: Promise<{ id: string; childId: string }> }) {
  const { id: eventId, childId } = await params;
  const actor = await requireActor(`/app/evenements/${eventId}/enfants/${childId}`);
  const { detail, handovers, timezone } = await guardPage(async () => {
    const [detail, handovers, timezone] = await Promise.all([getChildDetail(actor, eventId, childId), listHandovers(actor, eventId, childId), getUserTimezone(actor.userId)]);
    return { detail, handovers, timezone };
  });
  const { child, sensitive, emergencyContacts, authorizedPersons, attendance, assignments, presence, scope } = detail;
  const perms = scope.access.permissions;
  const canManage = perms.has("children.manage");
  const canRecord = perms.has("children.record_attendance");
  const canHandover = perms.has("children.handover");
  const canViewSensitive = perms.has("children.view_sensitive");
  const base = `/app/evenements/${eventId}/enfants`;
  const presenceMeta = PRESENCE_LABELS[presence];

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href={base}>
            <ArrowLeft className="size-4" aria-hidden="true" /> Retour à la liste
          </Link>
        </Button>
      </div>
      <PageHeader
        eyebrow="Fiche enfant"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {child.firstName} {child.lastName}
            <StatusBadge tone={presenceMeta.tone}>{presenceMeta.label}</StatusBadge>
          </span>
        }
        description={`${child.ageYears} ans · responsable : ${child.guardianName} (${child.guardianPhone})`}
        actions={
          <>
            {canRecord && presence === "expected" && (
              <ActionButton action={quickAttendanceAction.bind(null, eventId, childId, "check_in")} successMessage="Arrivée enregistrée." variant="default" size="default">
                <LogIn className="size-4" aria-hidden="true" /> Enregistrer l'arrivée
              </ActionButton>
            )}
            {canHandover && (
              <HandoverWizard
                childName={child.firstName}
                persons={authorizedPersons}
                actorName={actor.name}
                disabled={presence === "left" ? "Cet enfant a déjà été remis." : presence === "expected" ? "Enregistrez d'abord l'arrivée de l'enfant." : null}
                onConfirm={handoverAction.bind(null, eventId, childId)}
              />
            )}
            {canManage && (
              <ActionDialog
                trigger={
                  <Button variant="outline">
                    <Pencil className="size-4" aria-hidden="true" /> Modifier
                  </Button>
                }
                title="Modifier la fiche"
                action={updateChildAction.bind(null, eventId, childId)}
                successMessage="Fiche mise à jour."
                wide
              >
                <ChildFormFields initial={child} timezone={timezone} />
              </ActionDialog>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="gap-3 p-5">
            <h2 className="font-semibold">Consignes opérationnelles</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{child.careInstructions ?? "Aucune consigne particulière."}</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Régime</dt>
                <dd>{child.dietaryPreference ?? "Standard"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Horaires prévus</dt>
                <dd>
                  {child.expectedArrivalAt ? formatDateTime(child.expectedArrivalAt, timezone) : "—"} → {child.expectedDepartureAt ? formatDateTime(child.expectedDepartureAt, timezone) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Équipe affectée</dt>
                <dd>{assignments.length ? assignments.map((a) => a.name).join(", ") : "Non affecté"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Responsable informé</dt>
                <dd>{child.guardianInformedAt ? formatDateTime(child.guardianInformedAt, timezone) : "Pas encore"}</dd>
              </div>
            </dl>
          </Card>

          <SensitivePanel
            summary={sensitive}
            canView={canViewSensitive}
            canManage={canManage}
            onRead={readSensitiveAction.bind(null, eventId, childId)}
            onSet={setSensitiveAction.bind(null, eventId, childId)}
            onWithdraw={withdrawConsentAction.bind(null, eventId, childId)}
          />

          {canRecord && (
            <Card className="gap-3 p-5">
              <h2 className="font-semibold">Consigner un incident ou une note</h2>
              <ActionDialog
                trigger={<Button variant="outline">Ajouter une note / un incident</Button>}
                title="Note ou incident"
                action={recordAttendanceAction.bind(null, eventId, childId)}
                successMessage="Enregistré."
              >
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Type</legend>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="kind" value="note" defaultChecked /> Note
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="kind" value="incident" /> Incident
                  </label>
                </fieldset>
                <div className="space-y-1.5">
                  <Label htmlFor="note">Description *</Label>
                  <Textarea id="note" name="note" required rows={3} maxLength={2000} placeholder="Faits uniquement, pas d'information médicale ici." />
                </div>
              </ActionDialog>
            </Card>
          )}

          <Card className="gap-3 p-5">
            <h2 className="font-semibold">Historique</h2>
            {attendance.length === 0 && handovers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun mouvement enregistré.</p>
            ) : (
              <ul className="divide-y text-sm">
                {handovers.map((h) => (
                  <li key={h.id} className="flex flex-col gap-0.5 py-2">
                    <span className="font-medium">Remise à {h.receivedByName}</span>
                    <span className="text-muted-foreground">
                      {formatDateTime(h.handedOverAt, timezone)} · {h.identityVerifiedHow} · confirmée par {h.confirmedBy}
                    </span>
                    {h.note && <span className="text-muted-foreground">{h.note}</span>}
                  </li>
                ))}
                {attendance.map((a) => (
                  <li key={a.id} className="flex flex-col gap-0.5 py-2">
                    <span className="font-medium">{ATTENDANCE_LABELS[a.kind] ?? a.kind}</span>
                    <span className="text-muted-foreground">
                      {formatDateTime(a.recordedAt, timezone)} · par {a.recordedBy}
                      {a.note ? ` · ${a.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Contacts d'urgence</h2>
              {canManage && (
                <ActionDialog trigger={<Button variant="ghost" size="sm">Ajouter</Button>} title="Contact d'urgence" action={addEmergencyContactAction.bind(null, eventId, childId)} successMessage="Contact ajouté.">
                  <div className="space-y-1.5">
                    <Label htmlFor="ec-name">Nom *</Label>
                    <Input id="ec-name" name="name" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ec-rel">Lien *</Label>
                    <Input id="ec-rel" name="relationship" required placeholder="mère, grand-père…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ec-phone">Téléphone *</Label>
                    <Input id="ec-phone" name="phone" type="tel" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ec-prio">Priorité</Label>
                    <Input id="ec-prio" name="priority" type="number" min={1} max={9} defaultValue={emergencyContacts.length + 1} />
                  </div>
                </ActionDialog>
              )}
            </div>
            {emergencyContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun contact d'urgence : le responsable légal ({child.guardianPhone}) reste le premier appel.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {emergencyContacts.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {c.priority}. {c.name} <span className="text-muted-foreground">({c.relationship})</span>
                      </div>
                      <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-muted-foreground hover:underline">
                        <Phone className="size-3" aria-hidden="true" /> {c.phone}
                      </a>
                    </div>
                    {canManage && (
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon-xs" aria-label={`Supprimer ${c.name}`}>
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        }
                        title="Supprimer ce contact ?"
                        description={`${c.name} ne sera plus listé comme contact d'urgence.`}
                        onConfirm={removeEmergencyContactAction.bind(null, eventId, childId, c.id)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Personnes autorisées</h2>
              {canManage && (
                <ActionDialog trigger={<Button variant="ghost" size="sm">Ajouter</Button>} title="Personne autorisée à récupérer l'enfant" action={addAuthorizedPersonAction.bind(null, eventId, childId)} successMessage="Personne ajoutée.">
                  <div className="space-y-1.5">
                    <Label htmlFor="ap-name">Nom *</Label>
                    <Input id="ap-name" name="name" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ap-rel">Lien *</Label>
                    <Input id="ap-rel" name="relationship" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ap-phone">Téléphone</Label>
                    <Input id="ap-phone" name="phone" type="tel" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ap-hint">Comment vérifier son identité</Label>
                    <Input id="ap-hint" name="identityCheckHint" placeholder="pièce d'identité, connue de la mariée…" />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox name="isPrimaryGuardian" /> Responsable légal
                  </label>
                </ActionDialog>
              )}
            </div>
            {authorizedPersons.length === 0 ? (
              <p className="text-sm text-destructive">Aucune personne autorisée : aucune remise ne pourra être effectuée.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {authorizedPersons.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {p.name} <span className="text-muted-foreground">({p.relationship})</span>
                        {p.isPrimaryGuardian && <span className="ml-1 text-xs text-primary">· responsable légal</span>}
                      </div>
                      {p.identityCheckHint && <div className="text-xs text-muted-foreground">Vérification : {p.identityCheckHint}</div>}
                    </div>
                    {canManage && (
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon-xs" aria-label={`Retirer ${p.name}`}>
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        }
                        title="Retirer cette personne ?"
                        description={`${p.name} ne pourra plus récupérer l'enfant.`}
                        onConfirm={removeAuthorizedPersonAction.bind(null, eventId, childId, p.id)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canManage && (
            <Card className="gap-3 p-5">
              <h2 className="font-semibold">Information du responsable légal</h2>
              <p className="text-sm text-muted-foreground">Texte d'information à copier et envoyer au responsable (SMS, e-mail, message), puis marquez-le comme informé.</p>
              <details className="rounded-lg border bg-muted/40 p-3 text-sm">
                <summary className="cursor-pointer font-medium">Afficher le texte</summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-xs">{GUARDIAN_INFORMATION_TEXT}</pre>
              </details>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`mailto:${child.guardianEmail ?? ""}?subject=${encodeURIComponent("Informations concernant la garde de votre enfant")}&body=${encodeURIComponent(GUARDIAN_INFORMATION_TEXT)}`}>
                    <Copy className="size-4" aria-hidden="true" /> Préparer l'e-mail
                  </a>
                </Button>
                {!child.guardianInformedAt && (
                  <ActionButton action={markGuardianInformedAction.bind(null, eventId, childId)} successMessage="Responsable marqué comme informé.">
                    Marquer le responsable comme informé
                  </ActionButton>
                )}
              </div>
            </Card>
          )}

          {canManage && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" className="w-full text-destructive">
                  <Trash2 className="size-4" aria-hidden="true" /> Supprimer la fiche
                </Button>
              }
              title="Supprimer cet enfant ?"
              description="Toutes les données associées (contacts, personnes autorisées, informations de santé, présences) seront supprimées."
              confirmLabel="Supprimer"
              onConfirm={deleteChildAction.bind(null, eventId, childId)}
              successMessage="Fiche supprimée. Retournez à la liste."
            />
          )}
        </aside>
      </div>
    </div>
  );
}
