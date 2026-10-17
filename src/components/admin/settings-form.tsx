"use client";

import { useActionState } from "react";
import { updateSettingsAction } from "@/server/actions/admin/settings";
import { idleState } from "@/server/action-state";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/admin/submit-button";
import { HelpText, SubHeading } from "@/components/admin/section";
import { checkedOf, errorsOf, valueOf } from "@/components/admin/form-utils";
import type { VatMode } from "@/generated/prisma/enums";

export type SettingsFormValues = {
  brandName: string;
  tagline: string;
  ownerFirstName: string;
  contactEmail: string;
  contactPhone: string | null;
  areaLabel: string;
  hourlyRate: string;
  minimumHours: number;
  minimumAmount: string;
  defaultTravelFee: string;
  nightSurchargeStartHour: number;
  nightSurchargePercent: number;
  sundaySurchargePercent: number;
  vatMode: VatMode;
  vatRatePercent: string;
  publicEstimateEnabled: boolean;
  publicEstimateMarginPct: number;
  ratioUnder3: number;
  ratio3to5: number;
  ratio6to10: number;
  ratio11plus: number;
  minProviders: number;
  travelBufferMinutes: number;
  invitationExpiryHours: number;
  dataRetentionMonths: number;
};

function NumberField({ state, name, label, value, help, min, max, className }: { state: Parameters<typeof valueOf>[0]; name: string; label: string; value: number; help?: string; min: number; max: number; className?: string }) {
  return (
    <Field label={label} htmlFor={`st-${name}`} error={errorsOf(state, name)} help={help} required className={className}>
      <Input id={`st-${name}`} name={name} type="number" inputMode="numeric" min={min} max={max} defaultValue={valueOf(state, name, value)} invalid={Boolean(errorsOf(state, name))} />
    </Field>
  );
}

export function SettingsForm({ values, demoMode }: { values: SettingsFormValues; demoMode: boolean }) {
  const [state, action] = useActionState(updateSettingsAction, idleState);
  return (
    <form action={action} className="flex flex-col gap-8" noValidate>
      {state.status === "success" ? <Alert kind="success" role="status">{state.message}</Alert> : null}
      {state.status === "error" ? <Alert kind="danger" role="alert">{state.message}</Alert> : null}
      {demoMode ? (
        <Alert kind="demo">
          Valeurs de démonstration, à configurer avant toute exploitation réelle : tarifs, TVA, zone et coordonnées sont fictifs.
        </Alert>
      ) : null}

      <section aria-labelledby="st-identity">
        <SubHeading>
          <span id="st-identity">Identité et contact</span>
        </SubHeading>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Nom affiché" htmlFor="st-brandName" error={errorsOf(state, "brandName")} required>
            <Input id="st-brandName" name="brandName" defaultValue={valueOf(state, "brandName", values.brandName)} maxLength={120} required invalid={Boolean(errorsOf(state, "brandName"))} />
          </Field>
          <Field label="Prénom de la coordinatrice" htmlFor="st-ownerFirstName" error={errorsOf(state, "ownerFirstName")} required>
            <Input id="st-ownerFirstName" name="ownerFirstName" defaultValue={valueOf(state, "ownerFirstName", values.ownerFirstName)} maxLength={60} required invalid={Boolean(errorsOf(state, "ownerFirstName"))} />
          </Field>
          <Field label="Promesse (accroche)" htmlFor="st-tagline" error={errorsOf(state, "tagline")} required className="sm:col-span-2">
            <Input id="st-tagline" name="tagline" defaultValue={valueOf(state, "tagline", values.tagline)} maxLength={200} required invalid={Boolean(errorsOf(state, "tagline"))} />
          </Field>
          <Field label="Email de contact" htmlFor="st-contactEmail" error={errorsOf(state, "contactEmail")} required help="Reçoit les notifications (demandes, réponses des intervenant·es).">
            <Input id="st-contactEmail" name="contactEmail" type="email" inputMode="email" defaultValue={valueOf(state, "contactEmail", values.contactEmail)} required invalid={Boolean(errorsOf(state, "contactEmail"))} />
          </Field>
          <Field label="Téléphone de contact" htmlFor="st-contactPhone" error={errorsOf(state, "contactPhone")} optionalLabel>
            <Input id="st-contactPhone" name="contactPhone" type="tel" inputMode="tel" defaultValue={valueOf(state, "contactPhone", values.contactPhone)} maxLength={30} invalid={Boolean(errorsOf(state, "contactPhone"))} />
          </Field>
          <Field label="Zone d’intervention" htmlFor="st-areaLabel" error={errorsOf(state, "areaLabel")} required className="sm:col-span-2">
            <Input id="st-areaLabel" name="areaLabel" defaultValue={valueOf(state, "areaLabel", values.areaLabel)} maxLength={200} required invalid={Boolean(errorsOf(state, "areaLabel"))} />
          </Field>
        </div>
      </section>

      <section aria-labelledby="st-pricing">
        <SubHeading>
          <span id="st-pricing">Tarification</span>
        </SubHeading>
        <HelpText className="mt-1">Montants en euros ; ils servent à pré-remplir les propositions, que vous ajustez ensuite ligne par ligne.</HelpText>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Field label="Taux horaire par intervenant·e (€)" htmlFor="st-hourlyRate" error={errorsOf(state, "hourlyRateCents")} required>
            <Input id="st-hourlyRate" name="hourlyRateCents" inputMode="decimal" defaultValue={valueOf(state, "hourlyRateCents", values.hourlyRate)} required invalid={Boolean(errorsOf(state, "hourlyRateCents"))} />
          </Field>
          <NumberField state={state} name="minimumHours" label="Minimum d’heures facturées" value={values.minimumHours} min={0} max={24} />
          <Field label="Minimum de prestation (€)" htmlFor="st-minimumAmount" error={errorsOf(state, "minimumAmountCents")} optionalLabel help="Vide : aucun minimum global.">
            <Input id="st-minimumAmount" name="minimumAmountCents" inputMode="decimal" defaultValue={valueOf(state, "minimumAmountCents", values.minimumAmount)} invalid={Boolean(errorsOf(state, "minimumAmountCents"))} />
          </Field>
          <Field label="Forfait déplacement par défaut (€)" htmlFor="st-travelFee" error={errorsOf(state, "defaultTravelFeeCents")} required>
            <Input id="st-travelFee" name="defaultTravelFeeCents" inputMode="decimal" defaultValue={valueOf(state, "defaultTravelFeeCents", values.defaultTravelFee)} required invalid={Boolean(errorsOf(state, "defaultTravelFeeCents"))} />
          </Field>
          <NumberField state={state} name="nightSurchargeStartHour" label="Début de la majoration de nuit (heure)" value={values.nightSurchargeStartHour} min={0} max={23} />
          <NumberField state={state} name="nightSurchargePercent" label="Majoration de nuit (%)" value={values.nightSurchargePercent} min={0} max={200} />
          <NumberField state={state} name="sundaySurchargePercent" label="Majoration dimanche (%)" value={values.sundaySurchargePercent} min={0} max={200} />
          <Field label="Mode de TVA" htmlFor="st-vatMode" error={errorsOf(state, "vatMode")} required help="« Aucune » tant que le régime (franchise ou assujettissement) n’est pas confirmé : la mention apparaît sur les propositions.">
            <Select id="st-vatMode" name="vatMode" defaultValue={valueOf(state, "vatMode", values.vatMode)}>
              <option value="NONE">Aucune (régime à confirmer)</option>
              <option value="STANDARD">Assujetti, TVA appliquée</option>
            </Select>
          </Field>
          <Field label="Taux de TVA (%)" htmlFor="st-vatRate" error={errorsOf(state, "vatRatePercent") ?? errorsOf(state, "vatRateBps")} required>
            <Input id="st-vatRate" name="vatRatePercent" inputMode="decimal" defaultValue={valueOf(state, "vatRatePercent", values.vatRatePercent)} required invalid={Boolean(errorsOf(state, "vatRatePercent") ?? errorsOf(state, "vatRateBps"))} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Checkbox id="st-publicEstimate" name="publicEstimateEnabled" label="Afficher une estimation indicative sur le site public" defaultChecked={checkedOf(state, "publicEstimateEnabled", values.publicEstimateEnabled)} />
          <NumberField state={state} name="publicEstimateMarginPct" label="Marge de l’estimation publique (%)" value={values.publicEstimateMarginPct} min={0} max={100} />
        </div>
      </section>

      <section aria-labelledby="st-staffing" className="rounded-md border border-warning-600/30 bg-warning-100/40 p-4">
        <SubHeading>
          <span id="st-staffing">Repères d’encadrement</span>
        </SubHeading>
        <p className="mt-1 text-sm font-medium leading-snug text-warning-600">Repères internes à faire valider, pas des normes réglementaires. Ils servent uniquement à suggérer une taille d’équipe que vous confirmez dossier par dossier.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-5">
          <NumberField state={state} name="ratioUnder3" label="1 adulte pour… (moins de 3 ans)" value={values.ratioUnder3} min={1} max={20} />
          <NumberField state={state} name="ratio3to5" label="1 adulte pour… (3 à 5 ans)" value={values.ratio3to5} min={1} max={30} />
          <NumberField state={state} name="ratio6to10" label="1 adulte pour… (6 à 10 ans)" value={values.ratio6to10} min={1} max={30} />
          <NumberField state={state} name="ratio11plus" label="1 adulte pour… (11 ans et plus)" value={values.ratio11plus} min={1} max={40} />
          <NumberField state={state} name="minProviders" label="Équipe minimale" value={values.minProviders} min={1} max={10} />
        </div>
      </section>

      <section aria-labelledby="st-ops">
        <SubHeading>
          <span id="st-ops">Organisation et données</span>
        </SubHeading>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <NumberField state={state} name="travelBufferMinutes" label="Marge de déplacement entre deux missions (min)" value={values.travelBufferMinutes} min={0} max={600} help="Utilisée pour détecter les conflits horaires." />
          <NumberField state={state} name="invitationExpiryHours" label="Validité d’une proposition de mission (h)" value={values.invitationExpiryHours} min={1} max={720} />
          <NumberField state={state} name="dataRetentionMonths" label="Conservation des données (mois)" value={values.dataRetentionMonths} min={1} max={120} help="Durée annoncée dans la politique de confidentialité." />
        </div>
      </section>

      <div className="flex justify-end border-t border-sage-200 pt-4">
        <SubmitButton label="Enregistrer les paramètres" />
      </div>
    </form>
  );
}
