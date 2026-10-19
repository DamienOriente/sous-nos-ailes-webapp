import type { Metadata } from "next";
import Link from "next/link";
import { AgencyTiers } from "@/components/billing/agency-tiers";
import { AgencyTeam } from "@/components/professionals/agency-team";
import { ActionForm, FieldErrorText } from "@/components/professionals/action-form";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireActor } from "@/lib/session";
import { formatDateFr, formatEuros } from "@/lib/utils";
import { getAccountStructure } from "@/modules/professionals/application/agency-service";
import { listMembers, listMyAgencies } from "@/modules/professionals/application/member-service";
import { ORGANIZATION_ROLE_LABELS } from "@/modules/professionals/domain/members";
import { AGENCY_STATUS_LABELS, AGENCY_TYPE_LABELS, AGENCY_TYPE_VALUES } from "@/modules/professionals/domain/agency-schema";
import { changeMemberRoleAction, inviteMemberAction, removeMemberAction, requestAgencyAction, revokeMemberInvitationAction } from "./actions";

const TEAM_ACTIONS = { invite: inviteMemberAction, changeRole: changeMemberRoleAction, remove: removeMemberAction, revoke: revokeMemberInvitationAction };

export const metadata: Metadata = { title: "Ma structure" };

const TONES = { none: "neutral", pending: "warning", verified: "success", rejected: "danger" } as const;

export default async function StructurePage() {
  const actor = await requireActor("/app/pro/structure");
  const [s, agencies] = await Promise.all([getAccountStructure(actor), listMyAgencies(actor)]);
  const teams = await Promise.all(agencies.filter((a) => a.canManageMembers).map((a) => listMembers(actor, a.organizationId)));
  const memberships = agencies.filter((a) => a.role !== "owner");
  const org = s.organization;
  const status = org?.agencyStatus ?? "none";
  const editable = status !== "verified";
  return (
    <div className="space-y-8">
      <PageHeader
        title="Ma structure"
        description="Un indépendant gère une fiche. Une société, une association ou un organisme public qui propose plusieurs activités peut être validé comme agence et ajouter des fiches, au tarif dégressif ci-dessous."
        actions={<StatusBadge tone={TONES[status]}>{AGENCY_STATUS_LABELS[status]}</StatusBadge>}
      />

      {status === "rejected" && org?.agencyReviewNote && (
        <Card className="gap-2 p-5">
          <h2 className="font-heading text-lg font-semibold">Motif du refus</h2>
          <p className="text-sm text-pretty">{org.agencyReviewNote}</p>
          <p className="text-sm text-muted-foreground">Corrigez les informations puis renvoyez la demande.</p>
        </Card>
      )}

      {status === "verified" && org && (
        <Card className="gap-4 p-5">
          <h2 className="font-heading text-lg font-semibold">{org.name}</h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">
            <dt className="text-muted-foreground">SIRET</dt>
            <dd className="tabular-nums">{org.siret ?? "Non renseigné"}</dd>
            <dt className="text-muted-foreground">Validée le</dt>
            <dd>{org.agencyReviewedAt ? formatDateFr(org.agencyReviewedAt) : "Non renseigné"}</dd>
            <dt className="text-muted-foreground">Fiches en ligne ou en relecture</dt>
            <dd className="tabular-nums">{s.state?.countedListings ?? 0}</dd>
            <dt className="text-muted-foreground">Fiches supplémentaires payées</dt>
            <dd className="tabular-nums">{s.state?.paidExtra ?? 0}</dd>
            <dt className="text-muted-foreground">Abonnement agence</dt>
            <dd>{s.state?.subscriptionGrantsAccess ? `${formatEuros(s.monthlyCents)} TTC par mois` : "Aucun pour le moment"}</dd>
            {s.nextListingCents !== null && (
              <>
                <dt className="text-muted-foreground">Prochaine fiche</dt>
                <dd>{formatEuros(s.nextListingCents)} TTC par mois</dd>
              </>
            )}
          </dl>
          <p className="text-sm text-muted-foreground text-pretty">
            Le nombre de fiches payées suit les fiches en relecture ou en ligne : il augmente quand vous envoyez une nouvelle fiche à la relecture et baisse quand vous en archivez une. Pour modifier le nom ou le SIRET de la structure, écrivez-nous depuis la page <Link href="/contact" className="text-primary underline-offset-4 hover:underline">contact</Link>.
          </p>
        </Card>
      )}

      {memberships.length > 0 && (
        <Card className="gap-2 p-5">
          <h2 className="font-heading text-lg font-semibold">Agences dont vous êtes membre</h2>
          <ul className="space-y-1 text-sm">
            {memberships.map((m) => (
              <li key={m.organizationId}>
                <span className="font-medium">{m.name}</span>, {ORGANIZATION_ROLE_LABELS[m.role].toLowerCase()}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground text-pretty">
            Vous retrouvez leurs fiches dans <Link href="/app/pro" className="text-primary underline-offset-4 hover:underline">vos fiches pro</Link>. L&apos;abonnement agence reste géré par le propriétaire de chaque agence.
          </p>
        </Card>
      )}

      {teams.map((team) => (
        <AgencyTeam key={team.organizationId} team={team} actorUserId={actor.userId} actions={TEAM_ACTIONS} />
      ))}

      {status === "pending" && (
        <Card className="gap-2 p-5">
          <h2 className="font-heading text-lg font-semibold">Demande en cours de relecture</h2>
          <p className="text-sm text-muted-foreground text-pretty">Notre équipe vérifie le SIRET et l'activité de la structure. Vous recevrez une notification avec la décision. Vous pouvez corriger la demande tant qu'elle n'est pas traitée.</p>
        </Card>
      )}

      <div className={editable ? "grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" : "max-w-xl"}>
        {editable ? (
          <Card className="p-5 sm:p-6">
            <h2 className="font-heading text-lg font-semibold">{status === "none" ? "Demander le statut agence" : "Mettre à jour la demande"}</h2>
            <ActionForm action={requestAgencyAction} submitLabel={status === "none" ? "Envoyer la demande" : "Renvoyer la demande"} successMessage="Demande envoyée à notre équipe." className="mt-4">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Raison sociale</Label>
                  <Input id="name" name="name" required defaultValue={org?.name ?? ""} autoComplete="organization" />
                  <FieldErrorText name="name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type de structure</Label>
                  <select id="type" name="type" required defaultValue={org && org.type !== "sole_trader" && org.type !== "other" ? org.type : ""} className="h-9 w-full rounded-lg border bg-background px-3 text-sm">
                    <option value="" disabled>
                      Choisir
                    </option>
                    {AGENCY_TYPE_VALUES.map((v) => (
                      <option key={v} value={v}>
                        {AGENCY_TYPE_LABELS[v]}
                      </option>
                    ))}
                  </select>
                  <FieldErrorText name="type" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siret">SIRET</Label>
                  <Input id="siret" name="siret" required inputMode="numeric" defaultValue={org?.siret ?? ""} placeholder="14 chiffres" />
                  <FieldErrorText name="siret" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="addressLine1">Adresse du siège</Label>
                  <Input id="addressLine1" name="addressLine1" required defaultValue={org?.addressLine1 ?? ""} autoComplete="street-address" />
                  <FieldErrorText name="addressLine1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Code postal</Label>
                  <Input id="postalCode" name="postalCode" required inputMode="numeric" defaultValue={org?.postalCode ?? ""} autoComplete="postal-code" />
                  <FieldErrorText name="postalCode" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input id="city" name="city" required defaultValue={org?.city ?? ""} autoComplete="address-level2" />
                  <FieldErrorText name="city" />
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground text-pretty">Un micro-entrepreneur ou une entreprise individuelle garde une seule fiche : ajoutez vos autres métiers comme métiers secondaires de cette fiche.</p>
            </ActionForm>
          </Card>
        ) : null}
        <Card className="h-fit gap-3 p-5">
          <h2 className="font-heading text-lg font-semibold">Tarif des fiches supplémentaires</h2>
          <AgencyTiers tiers={s.tiers} />
          <p className="text-xs text-muted-foreground text-pretty">Le prix couvre la présence de la fiche dans l'annuaire. L'offre Premium reste une option de chaque fiche. Si l'abonnement agence s'arrête, une seule fiche reste visible ; les autres sont conservées et reviennent dès le règlement.</p>
        </Card>
      </div>
    </div>
  );
}
