"use client";

import { useActionState } from "react";
import { upsertOptionAction } from "@/server/actions/admin/settings";
import { idleState } from "@/server/action-state";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/admin/submit-button";
import { checkedOf, errorsOf, valueOf } from "@/components/admin/form-utils";
import { PRICING_UNIT_LABELS } from "@/components/admin/badges";
import type { PricingUnit } from "@/generated/prisma/enums";

export type OptionFormValues = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  price: string;
  pricingUnit: PricingUnit;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY: OptionFormValues = { id: "", code: "", label: "", description: null, price: "", pricingUnit: "FLAT", isActive: true, sortOrder: 0 };

/** Creates or edits a service option. `key` the component on the option id to reset the fields. */
export function OptionForm({ option }: { option?: OptionFormValues }) {
  const [state, action] = useActionState(upsertOptionAction, idleState);
  const values = option ?? EMPTY;
  const editing = Boolean(option);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.status === "success" ? <Alert kind="success" role="status">{state.message}</Alert> : null}
      {state.status === "error" ? <Alert kind="danger" role="alert">{state.message}</Alert> : null}
      <input type="hidden" name="id" value={values.id} readOnly />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code" htmlFor="opt-code" error={errorsOf(state, "code")} required help="Identifiant stable en minuscules (ex. atelier-creatif), repris dans les demandes.">
          <Input id="opt-code" name="code" defaultValue={valueOf(state, "code", values.code)} maxLength={40} required readOnly={editing} invalid={Boolean(errorsOf(state, "code"))} />
        </Field>
        <Field label="Libellé" htmlFor="opt-label" error={errorsOf(state, "label")} required>
          <Input id="opt-label" name="label" defaultValue={valueOf(state, "label", values.label)} maxLength={120} required invalid={Boolean(errorsOf(state, "label"))} />
        </Field>
        <Field label="Description" htmlFor="opt-description" error={errorsOf(state, "description")} optionalLabel className="sm:col-span-2">
          <Input id="opt-description" name="description" defaultValue={valueOf(state, "description", values.description)} maxLength={300} invalid={Boolean(errorsOf(state, "description"))} />
        </Field>
        <Field label="Prix (€)" htmlFor="opt-price" error={errorsOf(state, "priceCents")} required>
          <Input id="opt-price" name="priceCents" inputMode="decimal" defaultValue={valueOf(state, "priceCents", values.price)} placeholder="45,00" required invalid={Boolean(errorsOf(state, "priceCents"))} />
        </Field>
        <Field label="Unité" htmlFor="opt-unit" error={errorsOf(state, "pricingUnit")} required>
          <Select id="opt-unit" name="pricingUnit" defaultValue={valueOf(state, "pricingUnit", values.pricingUnit)}>
            {(Object.keys(PRICING_UNIT_LABELS) as PricingUnit[]).map((unit) => (
              <option key={unit} value={unit}>
                {PRICING_UNIT_LABELS[unit]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ordre d’affichage" htmlFor="opt-sortOrder" error={errorsOf(state, "sortOrder")}>
          <Input id="opt-sortOrder" name="sortOrder" type="number" inputMode="numeric" min={0} max={999} defaultValue={valueOf(state, "sortOrder", values.sortOrder)} invalid={Boolean(errorsOf(state, "sortOrder"))} />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox id="opt-isActive" name="isActive" label="Option proposée aux clients" defaultChecked={checkedOf(state, "isActive", values.isActive)} />
        </div>
      </div>
      <div className="flex justify-end">
        <SubmitButton label={editing ? "Enregistrer l’option" : "Créer l’option"} variant="secondary" />
      </div>
    </form>
  );
}
