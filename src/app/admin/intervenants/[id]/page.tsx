import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProviderVettingStatus } from "@/generated/prisma/enums";
import { getProviderForAdmin } from "@/server/services/providers";
import { listAuditForEntity } from "@/server/services/audit";
import { addAvailabilityAction, addQualificationAction, removeAvailabilityAction, setQualificationStatusAction, setVettingStatusAction } from "@/server/actions/admin/providers";
import { VETTING_STATUS_LABELS } from "@/domain/labels";
import { centsToEuroInput, formatEuros } from "@/lib/money";
import { formatEventWindow, formatInstantParis } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton, Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flash } from "@/components/admin/flash";
import { AdminSection, Disclosure, HelpText } from "@/components/admin/section";
import { AvailabilityKindBadge, EventStatusBadge, InvitationStatusBadge, QualificationBadge, VettingBadge, COST_BASIS_LABELS } from "@/components/admin/badges";
import { ProviderForm } from "@/components/admin/provider-form";
import { NotesSection } from "@/components/admin/notes-section";
import { AuditSection } from "@/components/admin/audit-list";

export const metadata: Metadata = { title: "Profil intervenant·e" };

const VETTING = Object.values(ProviderVettingStatus);

export default async function ProviderProfilePage({ params, searchParams }: PageProps<"/admin/intervenants/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [provider, audit] = await Promise.all([getProviderForAdmin(id), listAuditForEntity("ProviderProfile", id)]);
  if (!provider) notFound();
  const path = `/admin/intervenants/${id}`;
  const activeAssignments = provider.assignments.filter((a) => a.status === "ASSIGNED");

  return (
    <>
      <PageHeader
        title={provider.displayName}
        description={`${provider.user.name} · ${provider.user.email}${provider.user.phone ? ` · ${provider.user.phone}` : ""} · ${provider.city}`}
        meta={
          <>
            <VettingBadge status={provider.vettingStatus} />
            {!provider.isActive ? <StatusBadge tone="neutral">Profil inactif</StatusBadge> : null}
            <span className="text-[13px] font-medium text-ink-500 tabular">
              {activeAssignments.length} mission{activeAssignments.length > 1 ? "s" : ""} · {formatEuros(provider.agreedCostCents)} {COST_BASIS_LABELS[provider.costBasis]}
            </span>
          </>
        }
        actions={
          <LinkButton href="/admin/intervenants" variant="ghost" size="sm">
            Tous les profils
          </LinkButton>
        }
      />

      <Flash searchParams={query} />

      <AdminSection id="verification" title="Vérification manuelle" description="Vérification faite par Marie (entretien, pièces vues, références) : un statut de travail interne, qui ne vaut pas certification et n’est jamais présenté comme telle.">
        <form action={setVettingStatusAction.bind(null, id)} className="grid gap-4 rounded-md border border-sage-200 bg-ivory-50 p-4 sm:grid-cols-[minmax(0,16rem)_1fr_auto] sm:items-end">
          <Field label="Statut" htmlFor="vetting-status" required>
            <Select id="vetting-status" name="status" defaultValue={provider.vettingStatus}>
              {VETTING.map((status) => (
                <option key={status} value={status}>
                  {VETTING_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note de vérification" htmlFor="vetting-note" optionalLabel help={provider.vettedAt ? `Dernière vérification active le ${formatInstantParis(provider.vettedAt)}.` : "Ce qui a été vu, avec qui, quand."}>
            <Input id="vetting-note" name="note" defaultValue={provider.vettingNote ?? ""} maxLength={1000} />
          </Field>
          <Button type="submit" variant="secondary" className="h-11">
            Enregistrer
          </Button>
        </form>
      </AdminSection>

      <AdminSection id="profil" title="Profil">
        <ProviderForm
          mode="edit"
          providerId={id}
          values={{
            email: provider.user.email,
            name: provider.user.name,
            phone: provider.user.phone,
            displayName: provider.displayName,
            city: provider.city,
            postalCode: provider.postalCode,
            sector: provider.sector,
            bio: provider.bio,
            skills: provider.skills,
            costBasis: provider.costBasis,
            agreedCost: centsToEuroInput(provider.agreedCostCents),
            costNote: provider.costNote,
            isActive: provider.isActive,
          }}
        />
      </AdminSection>

      <AdminSection id="qualifications" title="Qualifications" description="Déclarées par la personne ou par vous ; marquées « vérifiées » seulement après contrôle d’une pièce.">
        {provider.qualifications.length ? (
          <ul className="divide-y divide-sage-100 rounded-md border border-sage-200 bg-ivory-50">
            {provider.qualifications.map((qualification) => (
              <li key={qualification.id} className="flex flex-col gap-3 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink-900">
                      {qualification.label}
                      {qualification.year ? <span className="ml-2 text-sm font-normal text-ink-500 tabular">{qualification.year}</span> : null}
                    </p>
                    <p className="text-sm text-ink-500">
                      {qualification.issuer ?? "Organisme non précisé"}
                      {qualification.verifiedAt ? ` · vérifiée le ${formatInstantParis(qualification.verifiedAt)}` : ""}
                      {qualification.verifiedNote ? ` · ${qualification.verifiedNote}` : ""}
                    </p>
                  </div>
                  <QualificationBadge status={qualification.status} />
                </div>
                <form action={setQualificationStatusAction.bind(null, id, qualification.id)} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Field label="Note de contrôle" htmlFor={`qual-note-${qualification.id}`} optionalLabel className="flex-1">
                    <Input id={`qual-note-${qualification.id}`} name="note" maxLength={500} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {qualification.status !== "VERIFIED" ? (
                      <Button type="submit" name="status" value="VERIFIED" variant="sage">
                        Marquer vérifiée
                      </Button>
                    ) : null}
                    {qualification.status !== "REJECTED" ? (
                      <Button type="submit" name="status" value="REJECTED" variant="danger">
                        Non retenue
                      </Button>
                    ) : null}
                    {qualification.status !== "DECLARED" ? (
                      <Button type="submit" name="status" value="DECLARED" variant="ghost">
                        Repasser en déclarée
                      </Button>
                    ) : null}
                  </div>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-ink-500">Aucune qualification déclarée.</p>
        )}
        <Disclosure summary="Ajouter une qualification déclarée">
          <form action={addQualificationAction.bind(null, id)} className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-end">
            <Field label="Intitulé" htmlFor="qual-label" required>
              <Input id="qual-label" name="label" maxLength={160} required />
            </Field>
            <Field label="Organisme" htmlFor="qual-issuer" optionalLabel>
              <Input id="qual-issuer" name="issuer" maxLength={160} />
            </Field>
            <Field label="Année" htmlFor="qual-year" optionalLabel>
              <Input id="qual-year" name="year" type="number" inputMode="numeric" min={1950} max={2100} />
            </Field>
            <Button type="submit" variant="secondary" className="h-11">
              Ajouter
            </Button>
          </form>
        </Disclosure>
      </AdminSection>

      <AdminSection id="disponibilites" title="Disponibilités déclarées" description="Créneaux déclarés disponibles ou indisponibles (heure de Paris). Les indisponibilités bloquent l’affectation ; les disponibilités améliorent le classement.">
        {provider.availabilities.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Période</Th>
                <Th>Note</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {provider.availabilities.map((availability) => (
                <tr key={availability.id}>
                  <Td>
                    <AvailabilityKindBadge kind={availability.kind} />
                  </Td>
                  <Td className="whitespace-nowrap tabular">
                    {formatInstantParis(availability.startsAt)} → {formatInstantParis(availability.endsAt)}
                  </Td>
                  <Td className="text-ink-700">{availability.note ?? "—"}</Td>
                  <Td className="text-right">
                    <form action={removeAvailabilityAction.bind(null, id, availability.id)}>
                      <Button type="submit" variant="ghost" size="sm" className="text-danger-600 hover:bg-danger-100">
                        Supprimer
                      </Button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-[15px] text-ink-500">Aucune période déclarée.</p>
        )}
        <Disclosure summary="Ajouter une période">
          <form action={addAvailabilityAction.bind(null, id)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <Field label="Type" htmlFor="av-kind" required>
              <Select id="av-kind" name="kind" defaultValue="AVAILABLE">
                <option value="AVAILABLE">Disponible</option>
                <option value="UNAVAILABLE">Indisponible</option>
              </Select>
            </Field>
            <Field label="Début (date)" htmlFor="av-startDate" required>
              <Input id="av-startDate" name="startDate" type="date" required />
            </Field>
            <Field label="Début (heure)" htmlFor="av-startTime" required>
              <Input id="av-startTime" name="startTime" type="time" required defaultValue="08:00" />
            </Field>
            <Field label="Fin (date)" htmlFor="av-endDate" required>
              <Input id="av-endDate" name="endDate" type="date" required />
            </Field>
            <Field label="Fin (heure)" htmlFor="av-endTime" required>
              <Input id="av-endTime" name="endTime" type="time" required defaultValue="23:00" />
            </Field>
            <Button type="submit" variant="secondary" className="h-11">
              Ajouter
            </Button>
            <Field label="Note" htmlFor="av-note" optionalLabel className="sm:col-span-2 lg:col-span-6">
              <Input id="av-note" name="note" maxLength={200} />
            </Field>
          </form>
        </Disclosure>
      </AdminSection>

      <AdminSection id="missions" title="Missions" description="Affectations passées et à venir.">
        {provider.assignments.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Référence</Th>
                <Th>Événement</Th>
                <Th>Date et horaires</Th>
                <Th>Statut du dossier</Th>
                <Th className="text-right">Coût convenu</Th>
              </tr>
            </thead>
            <tbody>
              {provider.assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <Td className="whitespace-nowrap tabular">
                    <Link href={`/admin/evenements/${assignment.event.id}`} className="font-semibold text-sage-800 hover:underline">
                      {assignment.event.reference}
                    </Link>
                  </Td>
                  <Td className="min-w-48">
                    {assignment.event.title}
                    {assignment.roleLabel ? <span className="block text-[13px] text-ink-500">{assignment.roleLabel}</span> : null}
                  </Td>
                  <Td className="min-w-56 text-ink-700">{formatEventWindow({ date: assignment.event.date, startsAt: assignment.event.startsAt, endsAt: assignment.event.endsAt })}</Td>
                  <Td>
                    <EventStatusBadge status={assignment.event.status} />
                  </Td>
                  <Td className="text-right whitespace-nowrap tabular">{formatEuros(assignment.agreedCostCents)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-[15px] text-ink-500">Aucune mission pour l’instant.</p>
        )}
      </AdminSection>

      <AdminSection id="propositions" title="Propositions de mission reçues">
        {provider.invitations.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Événement</Th>
                <Th>Envoyée le</Th>
                <Th>Statut</Th>
                <Th>Réponse</Th>
              </tr>
            </thead>
            <tbody>
              {provider.invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <Td className="min-w-48">
                    <Link href={`/admin/evenements/${invitation.event.id}`} className="font-semibold text-sage-800 hover:underline">
                      {invitation.event.reference}
                    </Link>
                    <span className="block text-[13px] text-ink-500">{invitation.event.title}</span>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-700">{formatInstantParis(invitation.sentAt)}</Td>
                  <Td>
                    <InvitationStatusBadge status={invitation.status} />
                  </Td>
                  <Td className="text-ink-700">
                    {invitation.respondedAt ? formatInstantParis(invitation.respondedAt) : "—"}
                    {invitation.responseNote ? <span className="block text-[13px] text-ink-500">« {invitation.responseNote} »</span> : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <HelpText>Aucune proposition envoyée à cette personne.</HelpText>
        )}
      </AdminSection>

      <NotesSection notes={provider.notes} target={{ providerId: id }} returnPath={path} />
      <AuditSection entries={audit} />
    </>
  );
}
