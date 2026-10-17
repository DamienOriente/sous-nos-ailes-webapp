"use client";

import { useActionState } from "react";
import { createProviderAction, updateProviderAction } from "@/server/actions/admin/providers";
import { idleState } from "@/server/action-state";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/admin/submit-button";
import { HelpText, SubHeading } from "@/components/admin/section";
import { checkedOf, errorsOf, valueOf } from "@/components/admin/form-utils";
import { COST_BASIS_LABELS } from "@/components/admin/badges";
import type { CostBasis } from "@/generated/prisma/enums";

export type ProviderFormValues = {
  email: string;
  name: string;
  phone: string | null;
  displayName: string;
  city: string;
  postalCode: string | null;
  sector: string;
  bio: string | null;
  skills: string[];
  costBasis: CostBasis;
  agreedCost: string;
  costNote: string | null;
  isActive: boolean;
};

const EMPTY: ProviderFormValues = { email: "", name: "", phone: null, displayName: "", city: "", postalCode: null, sector: "", bio: null, skills: [], costBasis: "PER_MISSION", agreedCost: "", costNote: null, isActive: true };

type Props = { mode: "create" } | { mode: "edit"; providerId: string; values: ProviderFormValues };

export function ProviderForm(props: Props) {
  const boundAction = props.mode === "create" ? createProviderAction : updateProviderAction.bind(null, props.providerId);
  const [state, action] = useActionState(boundAction, idleState);
  const values = props.mode === "edit" ? props.values : EMPTY;
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {state.status === "success" ? <Alert kind="success" role="status">{state.message}</Alert> : null}
      {state.status === "error" ? <Alert kind="danger" role="alert">{state.message}</Alert> : null}

      <div>
        <SubHeading>Identité et contact</SubHeading>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {props.mode === "create" ? (
            <Field label="Adresse email" htmlFor="pf-email" error={errorsOf(state, "email")} required help="Sert à la connexion : un lien de connexion est envoyé à cette adresse.">
              <Input id="pf-email" name="email" type="email" inputMode="email" autoComplete="off" defaultValue={valueOf(state, "email", values.email)} required invalid={Boolean(errorsOf(state, "email"))} />
            </Field>
          ) : (
            <Field label="Adresse email" htmlFor="pf-email-ro" help="L’adresse de connexion ne se modifie pas ici.">
              <Input id="pf-email-ro" value={values.email} readOnly />
            </Field>
          )}
          <Field label="Nom complet" htmlFor="pf-name" error={errorsOf(state, "name")} required>
            <Input id="pf-name" name="name" defaultValue={valueOf(state, "name", values.name)} maxLength={120} required invalid={Boolean(errorsOf(state, "name"))} />
          </Field>
          <Field label="Prénom d’affichage" htmlFor="pf-displayName" error={errorsOf(state, "displayName")} required help="Ce qui apparaît aux clients et dans les briefs.">
            <Input id="pf-displayName" name="displayName" defaultValue={valueOf(state, "displayName", values.displayName)} maxLength={80} required invalid={Boolean(errorsOf(state, "displayName"))} />
          </Field>
          <Field label="Téléphone" htmlFor="pf-phone" error={errorsOf(state, "phone")} optionalLabel>
            <Input id="pf-phone" name="phone" type="tel" inputMode="tel" defaultValue={valueOf(state, "phone", values.phone)} maxLength={30} invalid={Boolean(errorsOf(state, "phone"))} />
          </Field>
        </div>
      </div>

      <div>
        <SubHeading>Secteur et présentation</SubHeading>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Commune" htmlFor="pf-city" error={errorsOf(state, "city")} required>
            <Input id="pf-city" name="city" defaultValue={valueOf(state, "city", values.city)} maxLength={120} required invalid={Boolean(errorsOf(state, "city"))} />
          </Field>
          <Field label="Code postal" htmlFor="pf-postalCode" error={errorsOf(state, "postalCode")} optionalLabel>
            <Input id="pf-postalCode" name="postalCode" inputMode="numeric" defaultValue={valueOf(state, "postalCode", values.postalCode)} maxLength={5} invalid={Boolean(errorsOf(state, "postalCode"))} />
          </Field>
          <Field label="Secteur d’intervention" htmlFor="pf-sector" error={errorsOf(state, "sector")} required className="sm:col-span-2" help="Communes ou zone couvertes (exemple : « Lyon et ouest lyonnais », « tout le département »).">
            <Input id="pf-sector" name="sector" defaultValue={valueOf(state, "sector", values.sector)} maxLength={160} required invalid={Boolean(errorsOf(state, "sector"))} />
          </Field>
          <Field label="Compétences déclarées" htmlFor="pf-skills" error={errorsOf(state, "skills")} optionalLabel className="sm:col-span-2" help="Séparées par des virgules ; les codes d’options (ex. « atelier-creatif ») servent au classement des candidat·es.">
            <Input id="pf-skills" name="skills" defaultValue={valueOf(state, "skills", values.skills.join(", "))} maxLength={500} invalid={Boolean(errorsOf(state, "skills"))} />
          </Field>
          <Field label="Présentation" htmlFor="pf-bio" error={errorsOf(state, "bio")} optionalLabel className="sm:col-span-2">
            <Textarea id="pf-bio" name="bio" defaultValue={valueOf(state, "bio", values.bio)} maxLength={2000} invalid={Boolean(errorsOf(state, "bio"))} />
          </Field>
        </div>
      </div>

      <div>
        <SubHeading>Coût convenu</SubHeading>
        <HelpText className="mt-1">Montant interne, jamais visible des clients ni des autres intervenant·es.</HelpText>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Field label="Base" htmlFor="pf-costBasis" error={errorsOf(state, "costBasis")} required>
            <Select id="pf-costBasis" name="costBasis" defaultValue={valueOf(state, "costBasis", values.costBasis)}>
              {(Object.keys(COST_BASIS_LABELS) as CostBasis[]).map((basis) => (
                <option key={basis} value={basis}>
                  {COST_BASIS_LABELS[basis]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Montant (€)" htmlFor="pf-agreedCost" error={errorsOf(state, "agreedCostCents")} required>
            <Input id="pf-agreedCost" name="agreedCostCents" inputMode="decimal" defaultValue={valueOf(state, "agreedCostCents", values.agreedCost)} placeholder="120,00" required invalid={Boolean(errorsOf(state, "agreedCostCents"))} />
          </Field>
          <Field label="Précision" htmlFor="pf-costNote" error={errorsOf(state, "costNote")} optionalLabel>
            <Input id="pf-costNote" name="costNote" defaultValue={valueOf(state, "costNote", values.costNote)} maxLength={300} invalid={Boolean(errorsOf(state, "costNote"))} />
          </Field>
        </div>
      </div>

      {props.mode === "edit" ? <Checkbox id="pf-isActive" name="isActive" label="Profil actif (peut recevoir des propositions de mission)" defaultChecked={checkedOf(state, "isActive", values.isActive)} /> : null}

      <div className="flex flex-col gap-3 border-t border-sage-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        {props.mode === "create" ? <HelpText>À la création, la personne reçoit par email un lien de connexion vers son espace.</HelpText> : <span />}
        <SubmitButton label={props.mode === "create" ? "Créer le profil" : "Enregistrer le profil"} pendingLabel={props.mode === "create" ? "Création…" : "Enregistrement…"} />
      </div>
    </form>
  );
}
