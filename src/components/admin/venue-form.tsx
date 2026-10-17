"use client";

import { useActionState } from "react";
import { createVenueAction, updateVenueAction } from "@/server/actions/admin/venues";
import { idleState } from "@/server/action-state";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/admin/submit-button";
import { HelpText, SubHeading } from "@/components/admin/section";
import { errorsOf, valueOf } from "@/components/admin/form-utils";
import { PARTNERSHIP_STATUS_LABELS, VENUE_TYPE_LABELS } from "@/domain/labels";
import type { PartnershipStatus, VenueType } from "@/generated/prisma/enums";

export type VenueFormValues = {
  name: string;
  slug: string;
  type: VenueType;
  city: string;
  postalCode: string | null;
  region: string | null;
  officialWebsite: string | null;
  summary: string;
  description: string;
  childrenSpaces: string | null;
  constraints: string | null;
  accessInfo: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  partnershipStatus: PartnershipStatus;
  illustrationKey: string;
};

const EMPTY: VenueFormValues = { name: "", slug: "", type: "DOMAINE", city: "", postalCode: null, region: null, officialWebsite: null, summary: "", description: "", childrenSpaces: null, constraints: null, accessInfo: null, contactName: null, contactEmail: null, contactPhone: null, partnershipStatus: "PROSPECT", illustrationKey: "domaine" };

const VENUE_TYPES = Object.keys(VENUE_TYPE_LABELS) as VenueType[];
const PARTNERSHIP_STATUSES = Object.keys(PARTNERSHIP_STATUS_LABELS) as PartnershipStatus[];
const ILLUSTRATION_LABELS: Record<string, string> = { domaine: "Domaine", chateau: "Château", salle: "Salle", jardin: "Jardin", orangerie: "Orangerie" };

type Props = ({ mode: "create" } | { mode: "edit"; venueId: string; values: VenueFormValues }) & { illustrations: readonly string[] };

export function VenueForm(props: Props) {
  const boundAction = props.mode === "create" ? createVenueAction : updateVenueAction.bind(null, props.venueId);
  const [state, action] = useActionState(boundAction, idleState);
  const values = props.mode === "edit" ? props.values : EMPTY;
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {state.status === "success" ? <Alert kind="success" role="status">{state.message}</Alert> : null}
      {state.status === "error" ? <Alert kind="danger" role="alert">{state.message}</Alert> : null}

      <div>
        <SubHeading>Le lieu</SubHeading>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Nom" htmlFor="vf-name" error={errorsOf(state, "name")} required>
            <Input id="vf-name" name="name" defaultValue={valueOf(state, "name", values.name)} maxLength={160} required invalid={Boolean(errorsOf(state, "name"))} />
          </Field>
          <Field label="Adresse de la page (slug)" htmlFor="vf-slug" error={errorsOf(state, "slug")} optionalLabel help="Vide : dérivée du nom. Rendue unique automatiquement.">
            <Input id="vf-slug" name="slug" defaultValue={valueOf(state, "slug", values.slug)} maxLength={80} invalid={Boolean(errorsOf(state, "slug"))} />
          </Field>
          <Field label="Type" htmlFor="vf-type" error={errorsOf(state, "type")} required>
            <Select id="vf-type" name="type" defaultValue={valueOf(state, "type", values.type)}>
              {VENUE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {VENUE_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Illustration" htmlFor="vf-illustration" error={errorsOf(state, "illustrationKey")} required help="Dessin générique utilisé sur la page publique (aucune photo du lieu).">
            <Select id="vf-illustration" name="illustrationKey" defaultValue={valueOf(state, "illustrationKey", values.illustrationKey)}>
              {props.illustrations.map((key) => (
                <option key={key} value={key}>
                  {ILLUSTRATION_LABELS[key] ?? key}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Commune" htmlFor="vf-city" error={errorsOf(state, "city")} required>
            <Input id="vf-city" name="city" defaultValue={valueOf(state, "city", values.city)} maxLength={120} required invalid={Boolean(errorsOf(state, "city"))} />
          </Field>
          <Field label="Code postal" htmlFor="vf-postalCode" error={errorsOf(state, "postalCode")} optionalLabel>
            <Input id="vf-postalCode" name="postalCode" inputMode="numeric" defaultValue={valueOf(state, "postalCode", values.postalCode)} maxLength={5} invalid={Boolean(errorsOf(state, "postalCode"))} />
          </Field>
          <Field label="Région" htmlFor="vf-region" error={errorsOf(state, "region")} optionalLabel>
            <Input id="vf-region" name="region" defaultValue={valueOf(state, "region", values.region)} maxLength={120} invalid={Boolean(errorsOf(state, "region"))} />
          </Field>
          <Field label="Site officiel" htmlFor="vf-website" error={errorsOf(state, "officialWebsite")} optionalLabel>
            <Input id="vf-website" name="officialWebsite" type="url" inputMode="url" defaultValue={valueOf(state, "officialWebsite", values.officialWebsite)} placeholder="https://" invalid={Boolean(errorsOf(state, "officialWebsite"))} />
          </Field>
        </div>
      </div>

      <div>
        <SubHeading>Présentation publique</SubHeading>
        <HelpText className="mt-1">Texte original rédigé par vous : la publication exige un résumé d’au moins 40 caractères et une présentation d’au moins 200.</HelpText>
        <div className="mt-3 flex flex-col gap-4">
          <Field label="Résumé" htmlFor="vf-summary" error={errorsOf(state, "summary")} required>
            <Textarea id="vf-summary" name="summary" defaultValue={valueOf(state, "summary", values.summary)} maxLength={400} className="min-h-20" required invalid={Boolean(errorsOf(state, "summary"))} />
          </Field>
          <Field label="Présentation" htmlFor="vf-description" error={errorsOf(state, "description")} required help="Paragraphes séparés par une ligne vide.">
            <Textarea id="vf-description" name="description" defaultValue={valueOf(state, "description", values.description)} maxLength={6000} className="min-h-48" required invalid={Boolean(errorsOf(state, "description"))} />
          </Field>
          <Field label="Espaces pour les enfants" htmlFor="vf-childrenSpaces" error={errorsOf(state, "childrenSpaces")} optionalLabel>
            <Textarea id="vf-childrenSpaces" name="childrenSpaces" defaultValue={valueOf(state, "childrenSpaces", values.childrenSpaces)} maxLength={2000} className="min-h-20" invalid={Boolean(errorsOf(state, "childrenSpaces"))} />
          </Field>
        </div>
      </div>

      <div>
        <SubHeading>Informations opérationnelles</SubHeading>
        <HelpText className="mt-1">Reprises dans les briefs de mission ; les coordonnées du contact ne sont jamais publiées.</HelpText>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Points de vigilance" htmlFor="vf-constraints" error={errorsOf(state, "constraints")} optionalLabel className="sm:col-span-2">
            <Textarea id="vf-constraints" name="constraints" defaultValue={valueOf(state, "constraints", values.constraints)} maxLength={2000} className="min-h-20" invalid={Boolean(errorsOf(state, "constraints"))} />
          </Field>
          <Field label="Accès et stationnement" htmlFor="vf-accessInfo" error={errorsOf(state, "accessInfo")} optionalLabel className="sm:col-span-2">
            <Textarea id="vf-accessInfo" name="accessInfo" defaultValue={valueOf(state, "accessInfo", values.accessInfo)} maxLength={2000} className="min-h-20" invalid={Boolean(errorsOf(state, "accessInfo"))} />
          </Field>
          <Field label="Contact sur place" htmlFor="vf-contactName" error={errorsOf(state, "contactName")} optionalLabel>
            <Input id="vf-contactName" name="contactName" defaultValue={valueOf(state, "contactName", values.contactName)} maxLength={120} invalid={Boolean(errorsOf(state, "contactName"))} />
          </Field>
          <Field label="Email du contact" htmlFor="vf-contactEmail" error={errorsOf(state, "contactEmail")} optionalLabel>
            <Input id="vf-contactEmail" name="contactEmail" type="email" inputMode="email" defaultValue={valueOf(state, "contactEmail", values.contactEmail)} invalid={Boolean(errorsOf(state, "contactEmail"))} />
          </Field>
          <Field label="Téléphone du contact" htmlFor="vf-contactPhone" error={errorsOf(state, "contactPhone")} optionalLabel>
            <Input id="vf-contactPhone" name="contactPhone" type="tel" inputMode="tel" defaultValue={valueOf(state, "contactPhone", values.contactPhone)} maxLength={30} invalid={Boolean(errorsOf(state, "contactPhone"))} />
          </Field>
          <Field label="Partenariat" htmlFor="vf-partnership" error={errorsOf(state, "partnershipStatus")} required>
            <Select id="vf-partnership" name="partnershipStatus" defaultValue={valueOf(state, "partnershipStatus", values.partnershipStatus)}>
              {PARTNERSHIP_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PARTNERSHIP_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div className="flex justify-end border-t border-sage-200 pt-4">
        <SubmitButton label={props.mode === "create" ? "Créer le lieu" : "Enregistrer la fiche"} pendingLabel={props.mode === "create" ? "Création…" : "Enregistrement…"} />
      </div>
    </form>
  );
}
