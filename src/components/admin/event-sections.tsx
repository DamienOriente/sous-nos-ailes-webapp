import Link from "next/link";
import type { EventStatus } from "@/generated/prisma/enums";
import type { AdminEventDetail } from "@/server/services/events";
import type { RankedCandidate } from "@/domain/staffing";
import type { AvailabilityStatus } from "@/domain/scheduling";
import { MANUAL_TRANSITIONS } from "@/domain/workflow";
import { EVENT_STATUS_LABELS } from "@/domain/labels";
import { formatEuros, centsToEuroInput } from "@/lib/money";
import { formatInstantParis } from "@/lib/time";
import { addChecklistItemAction, removeChecklistItemAction, setOpsValidationAction, toggleChecklistItemAction, transitionEventAction } from "@/server/actions/admin/events";
import { createDraftAction } from "@/server/actions/admin/quotes";
import { cancelAssignmentAction, inviteProvidersAction, withdrawInvitationAction } from "@/server/actions/admin/team";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminSection, Disclosure, HelpText, SubHeading } from "@/components/admin/section";
import { InvitationStatusBadge, QuoteStatusBadge, TeamStatusBadge, VettingBadge } from "@/components/admin/badges";
import { AssignForm } from "@/components/admin/assign-form";

const CLOSED: EventStatus[] = ["COMPLETED", "CANCELLED", "DECLINED"];

const TRANSITION_LABELS: Partial<Record<`${EventStatus}>${EventStatus}`, string>> = {
  "NEW>QUALIFYING": "Prendre en charge la demande",
  "NEW>DECLINED": "Refuser la demande",
  "NEW>CANCELLED": "Annuler la demande",
  "QUALIFYING>DECLINED": "Refuser la demande",
  "QUALIFYING>CANCELLED": "Annuler la demande",
  "PROPOSAL_SENT>QUALIFYING": "Revenir à la qualification",
  "PROPOSAL_SENT>DECLINED": "Refuser la demande",
  "PROPOSAL_SENT>CANCELLED": "Annuler",
  "AGREED>PREPARING": "Lancer la préparation",
  "AGREED>CANCELLED": "Annuler",
  "PREPARING>CONFIRMED": "Confirmer la prestation",
  "PREPARING>CANCELLED": "Annuler",
  "CONFIRMED>COMPLETED": "Marquer comme réalisée",
  "CONFIRMED>PREPARING": "Revenir en préparation",
  "CONFIRMED>CANCELLED": "Annuler",
  "DECLINED>QUALIFYING": "Réouvrir la demande",
};

function transitionVariant(to: EventStatus): "sage" | "danger" | "secondary" {
  if (to === "CONFIRMED") return "sage";
  if (to === "DECLINED" || to === "CANCELLED") return "danger";
  return "secondary";
}

export function EventActionsSection({ event }: { event: AdminEventDetail }) {
  const transitions = MANUAL_TRANSITIONS[event.status];
  const opsValidated = Boolean(event.opsValidatedAt);
  return (
    <AdminSection id="actions" title="Actions" description="Changements de statut manuels. L’envoi d’une proposition et l’accord du client font avancer le dossier automatiquement.">
      {transitions.length ? (
        <form action={transitionEventAction.bind(null, event.id)} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {transitions.map((to) => {
              const blocked = to === "CONFIRMED" && !event.confirmation.ok;
              return (
                <Button key={to} type="submit" name="to" value={to} variant={transitionVariant(to)} size="sm" disabled={blocked} aria-describedby={blocked ? "confirmation-blockers" : undefined}>
                  {TRANSITION_LABELS[`${event.status}>${to}`] ?? EVENT_STATUS_LABELS[to]}
                </Button>
              );
            })}
          </div>
          {transitions.includes("CONFIRMED") && !event.confirmation.ok ? (
            <Alert kind="warning" role="status" title="Confirmation impossible pour l’instant">
              <ul id="confirmation-blockers" className="list-disc pl-5">
                {event.confirmation.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
          <Disclosure summary="Indiquer un motif (refus ou annulation)">
            <Field label="Motif" htmlFor="transition-reason" optionalLabel help="Conservé dans le dossier et l’historique ; non transmis automatiquement au client.">
              <Textarea id="transition-reason" name="reason" maxLength={300} className="min-h-20" />
            </Field>
          </Disclosure>
        </form>
      ) : (
        <p className="text-[15px] text-ink-500">Ce dossier est clos : aucun changement de statut possible.</p>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-sage-200 bg-ivory-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[15px] font-semibold text-ink-900">Points opérationnels {opsValidated ? "validés" : "à valider"}</p>
          <p className="text-sm text-ink-500">{opsValidated ? `Validés le ${formatInstantParis(event.opsValidatedAt)}. Retirer la validation si un élément change.` : "Espace, point de rendez-vous et contact sur place vérifiés par vous : condition de la confirmation."}</p>
        </div>
        {!CLOSED.includes(event.status) ? (
          <form action={setOpsValidationAction.bind(null, event.id, !opsValidated)}>
            <Button type="submit" variant={opsValidated ? "ghost" : "secondary"} size="sm">
              {opsValidated ? "Retirer la validation" : "Valider les points opérationnels"}
            </Button>
          </form>
        ) : null}
      </div>
    </AdminSection>
  );
}

export function ChecklistSection({ event }: { event: AdminEventDetail }) {
  const done = event.checklist.filter((item) => item.isDone).length;
  return (
    <AdminSection id="checklist" title="Checklist de préparation" description={`${done}/${event.checklist.length} élément${event.checklist.length > 1 ? "s" : ""} fait${done > 1 ? "s" : ""}. Les éléments automatiques suivent la fiche ; ajoutez les vôtres.`}>
      {event.checklist.length ? (
        <ul className="divide-y divide-sage-100 rounded-md border border-sage-200 bg-ivory-50">
          {event.checklist.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <form action={toggleChecklistItemAction.bind(null, event.id, item.id, !item.isDone)} className="flex min-w-0 flex-1 items-center gap-3">
                <button type="submit" className="flex min-w-0 cursor-pointer items-center gap-3 text-left" aria-pressed={item.isDone} aria-label={`${item.isDone ? "Marquer à faire" : "Marquer fait"} : ${item.label}`}>
                  <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-[3px] border ${item.isDone ? "border-sage-700 bg-sage-700 text-ivory-50" : "border-sage-400 bg-ivory-50"}`}>
                    {item.isDone ? "✓" : ""}
                  </span>
                  <span className={`text-[15px] ${item.isDone ? "text-ink-500 line-through" : "text-ink-900"}`}>{item.label}</span>
                </button>
              </form>
              <div className="flex items-center gap-3 text-[13px] text-ink-500">
                {item.isAuto ? <span>automatique</span> : null}
                {!item.isAuto ? (
                  <form action={removeChecklistItemAction.bind(null, event.id, item.id)}>
                    <Button type="submit" variant="ghost" size="sm" className="text-danger-600 hover:bg-danger-100">
                      Retirer
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-ink-500">La checklist se construit dès que la fiche est renseignée.</p>
      )}
      <form action={addChecklistItemAction.bind(null, event.id)} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Ajouter un élément" htmlFor="checklist-label" className="flex-1">
          <Input id="checklist-label" name="label" maxLength={200} required placeholder="Ex. : prévoir des couvertures pour le temps calme" />
        </Field>
        <Button type="submit" variant="secondary">
          Ajouter
        </Button>
      </form>
    </AdminSection>
  );
}

export function ProposalsSection({ event }: { event: AdminEventDetail }) {
  const versions = event.quote?.versions ?? [];
  const hasDraft = versions.some((v) => v.status === "DRAFT");
  const closed = CLOSED.includes(event.status);
  return (
    <AdminSection
      id="propositions"
      title="Propositions"
      description="Chaque version transmise est figée ; une nouvelle version remplace la précédente auprès du client."
      actions={
        !closed ? (
          <form action={createDraftAction.bind(null, event.id)}>
            <Button type="submit" variant={hasDraft ? "secondary" : "primary"} size="sm">
              {hasDraft ? "Reprendre le brouillon" : "Préparer une nouvelle version"}
            </Button>
          </form>
        ) : undefined
      }
    >
      {versions.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Version</Th>
              <Th>Statut</Th>
              <Th className="text-right">Total</Th>
              <Th>Transmise le</Th>
              <Th>Accord le</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {versions.map((version) => (
              <tr key={version.id}>
                <Td className="whitespace-nowrap">
                  <span className="font-semibold tabular">Version {version.number}</span>
                  <span className="block text-[13px] text-ink-500">{version.title}</span>
                </Td>
                <Td>
                  <QuoteStatusBadge status={version.status} />
                </Td>
                <Td className="text-right tabular whitespace-nowrap">{formatEuros(version.totalInclVatCents)}</Td>
                <Td className="whitespace-nowrap text-ink-700">{version.sentAt ? formatInstantParis(version.sentAt) : "—"}</Td>
                <Td className="whitespace-nowrap text-ink-700">
                  {version.acceptedAt ? formatInstantParis(version.acceptedAt) : "—"}
                  {version.acceptedBy ? <span className="block text-[13px] text-ink-500">{version.acceptedBy.name}</span> : null}
                </Td>
                <Td className="whitespace-nowrap">
                  <div className="flex flex-wrap gap-3 text-[15px] font-semibold text-sage-800">
                    {version.status === "DRAFT" ? (
                      <Link href={`/admin/evenements/${event.id}/propositions/${version.id}/modifier`} className="hover:underline">
                        Modifier
                      </Link>
                    ) : null}
                    <Link href={`/admin/evenements/${event.id}/propositions/${version.id}`} className="hover:underline">
                      Document
                    </Link>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="text-[15px] text-ink-500">Aucune proposition pour l’instant. La première version est pré-remplie par le moteur de tarification à partir de la fiche.</p>
      )}
    </AdminSection>
  );
}

const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = { DECLARED_AVAILABLE: "Disponibilité déclarée", PARTIAL: "Disponibilité partielle", NOT_DECLARED: "Non déclarée" };

export function TeamSection({ event, candidates }: { event: AdminEventDetail; candidates: RankedCandidate[] }) {
  const assignments = event.activeAssignments;
  const closed = CLOSED.includes(event.status);
  const hasWindow = Boolean(event.startsAt && event.endsAt);
  const acceptedToAssign = event.invitations.filter((i) => i.status === "ACCEPTED" && !i.assignment);
  const conflictsFor = (assignmentId: string) => event.assignmentConflicts.find((c) => c.assignmentId === assignmentId)?.conflicts ?? [];

  return (
    <AdminSection id="equipe" title="Équipe" description={`${assignments.length}/${event.requiredProviders} personne${event.requiredProviders > 1 ? "s" : ""} affectée${assignments.length > 1 ? "s" : ""}. Coût interne de l’équipe : ${formatEuros(event.providerCostCents)} (jamais montré au client).`} actions={<TeamStatusBadge status={event.teamStatus} />}>
      <div className="flex flex-col gap-3">
        <SubHeading>Personnes affectées</SubHeading>
        {assignments.length ? (
          <ul className="divide-y divide-sage-100 rounded-md border border-sage-200 bg-ivory-50">
            {assignments.map((assignment) => {
              const conflicts = conflictsFor(assignment.id);
              return (
                <li key={assignment.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink-900">
                        {assignment.provider.displayName}
                        {assignment.roleLabel ? <span className="ml-2 text-sm font-normal text-ink-500">{assignment.roleLabel}</span> : null}
                      </p>
                      <p className="text-sm text-ink-500">
                        {assignment.provider.user.phone ?? "Téléphone non renseigné"} · coût convenu {formatEuros(assignment.agreedCostCents)} · affectée le {formatInstantParis(assignment.assignedAt)}
                      </p>
                    </div>
                    {!closed ? (
                      <Disclosure summary="Retirer de l’équipe" className="w-full sm:w-auto">
                        <form action={cancelAssignmentAction.bind(null, event.id, assignment.id)} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <Field label="Motif" htmlFor={`cancel-${assignment.id}`} optionalLabel className="flex-1">
                            <Input id={`cancel-${assignment.id}`} name="reason" maxLength={300} />
                          </Field>
                          <Button type="submit" variant="danger" size="sm" className="h-11">
                            Confirmer le retrait
                          </Button>
                        </form>
                      </Disclosure>
                    ) : null}
                  </div>
                  {conflicts.length ? (
                    <Alert kind="danger" role="alert" title="Conflit horaire">
                      <ul className="list-disc pl-5">
                        {conflicts.map((conflict) => (
                          <li key={conflict.id}>{conflict.explanation}</li>
                        ))}
                      </ul>
                    </Alert>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[15px] text-ink-500">Personne n’est encore affectée.</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <SubHeading>Propositions de mission</SubHeading>
        {event.invitations.length ? (
          <ul className="divide-y divide-sage-100 rounded-md border border-sage-200 bg-ivory-50">
            {event.invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-col gap-3 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{invitation.provider.displayName}</p>
                    <p className="text-sm text-ink-500">
                      Envoyée le {formatInstantParis(invitation.sentAt)} · expire le {formatInstantParis(invitation.expiresAt)}
                      {invitation.respondedAt ? ` · réponse le ${formatInstantParis(invitation.respondedAt)}` : ""}
                    </p>
                    {invitation.responseNote ? <p className="mt-1 text-[15px] text-ink-700">« {invitation.responseNote} »</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <InvitationStatusBadge status={invitation.status} />
                    {invitation.assignment ? <StatusBadge tone="sage">Affectée</StatusBadge> : null}
                    {invitation.status === "PENDING" && !closed ? (
                      <form action={withdrawInvitationAction.bind(null, event.id, invitation.id)}>
                        <Button type="submit" variant="ghost" size="sm">
                          Retirer la proposition
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
                {invitation.status === "ACCEPTED" && !invitation.assignment && !closed ? (
                  <div className="rounded-md border border-sage-200 bg-ivory-100 px-3 py-3">
                    <p className="mb-2 text-sm text-ink-700">Disponibilité confirmée par la personne : l’affectation reste votre décision.</p>
                    <AssignForm eventId={event.id} invitationId={invitation.id} providerId={invitation.providerId} providerName={invitation.provider.displayName} defaultCost={centsToEuroInput(invitation.provider.agreedCostCents)} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-ink-500">Aucune proposition envoyée pour l’instant.</p>
        )}
        {acceptedToAssign.length ? <HelpText>{acceptedToAssign.length} personne{acceptedToAssign.length > 1 ? "s ont" : " a"} accepté sans être encore affectée : affectez-les ci-dessus pour compléter l’équipe.</HelpText> : null}
      </div>

      {!closed ? (
        <div className="flex flex-col gap-3">
          <SubHeading>Proposer la mission</SubHeading>
          {!hasWindow ? (
            <Alert kind="info" role="status">
              Fixez la date et les horaires dans la fiche avant de proposer la mission : la disponibilité et les conflits se calculent sur le créneau exact.
            </Alert>
          ) : (
            <form action={inviteProvidersAction.bind(null, event.id)} className="flex flex-col gap-4">
              <HelpText>Classement sur disponibilité déclarée, vérification manuelle, secteur et qualifications vérifiées, jamais sur une caractéristique personnelle. Chaque raison est visible ; vous décidez.</HelpText>
              <Table>
                <thead>
                  <tr>
                    <Th>
                      <span className="sr-only">Sélection</span>
                    </Th>
                    <Th>Personne</Th>
                    <Th>Disponibilité</Th>
                    <Th>Vérification</Th>
                    <Th className="text-right">Score</Th>
                    <Th>Pourquoi</Th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => {
                    const selectable = candidate.eligible && !candidate.alreadyInvited && !candidate.alreadyAssigned;
                    const inputId = `candidate-${candidate.providerId}`;
                    return (
                      <tr key={candidate.providerId} className={selectable ? "" : "text-ink-500"}>
                        <Td>
                          <Checkbox id={inputId} name="providerIds[]" value={candidate.providerId} disabled={!selectable} label={<span className="sr-only">Proposer à {candidate.displayName}</span>} />
                        </Td>
                        <Td className="min-w-44">
                          <Link href={`/admin/intervenants/${candidate.providerId}`} className="font-semibold text-sage-800 hover:underline">
                            {candidate.displayName}
                          </Link>
                          <span className="block text-[13px] text-ink-500">{candidate.sector}</span>
                          {candidate.alreadyInvited ? <span className="block text-[13px] text-warning-600">Proposition déjà en attente</span> : null}
                          {candidate.alreadyAssigned ? <span className="block text-[13px] text-sage-800">Déjà dans l’équipe</span> : null}
                          {!candidate.eligible && !candidate.alreadyAssigned ? <span className="block text-[13px] text-danger-600">Non éligible</span> : null}
                        </Td>
                        <Td className="whitespace-nowrap">{AVAILABILITY_LABELS[candidate.availability]}</Td>
                        <Td>
                          <VettingBadge status={candidate.vettingStatus} />
                        </Td>
                        <Td className="text-right tabular">{candidate.score}</Td>
                        <Td className="min-w-64">
                          <details>
                            <summary className="cursor-pointer text-[15px] font-semibold text-sage-800">Pourquoi ?</summary>
                            <ul className="mt-2 list-disc pl-5 text-sm leading-snug text-ink-700">
                              {candidate.reasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          </details>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <Field label="Message joint à la proposition" htmlFor="invite-message" optionalLabel help="Repris dans l’email envoyé à chaque personne cochée.">
                <Textarea id="invite-message" name="message" maxLength={1000} className="min-h-20" />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="sage">
                  Proposer la mission aux personnes cochées
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </AdminSection>
  );
}

export function ReadinessList({ items }: { items: AdminEventDetail["readiness"]["items"] }) {
  return (
    <ul className="grid gap-1.5 text-[15px] sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-2">
          <span aria-hidden="true" className={`mt-1.5 size-3 shrink-0 rounded-full border ${item.done ? "border-sage-700 bg-sage-700" : "border-sage-400"}`} />
          <span className={item.done ? "text-ink-500" : "text-ink-900"}>
            {item.label}
            {item.detail ? <span className="ml-1 text-[13px] text-ink-500">({item.detail})</span> : null}
            <span className="sr-only">{item.done ? " — fait" : " — à faire"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
