import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldErrorText } from "@/components/professionals/action-form";
import { getTradeForm, type TradeField } from "@/modules/professionals/domain/trade-forms";

/**
 * Renders the declarative trade form with native inputs (server-renderable).
 * Field names are prefixed with `trade.` so the action can split them out.
 */
export function TradeFormFields({ formSchemaKey, values, prefix = "trade." }: { formSchemaKey: string; values: Record<string, unknown>; prefix?: string }) {
  const def = getTradeForm(formSchemaKey);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">{def.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{def.intro}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {def.fields.map((f) => (
          <TradeFieldInput key={f.name} field={f} value={values[f.name]} name={`${prefix}${f.name}`} />
        ))}
      </div>
      {def.requiredDocuments.length > 0 && (
        <aside className="rounded-xl border border-dashed bg-muted/40 p-4 text-sm">
          <p className="font-medium">Justificatifs que nous vous demanderons ensuite</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {def.requiredDocuments.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Ils sont lus par notre équipe uniquement et ne sont jamais publiés.</p>
        </aside>
      )}
    </div>
  );
}

function TradeFieldInput({ field: f, value, name }: { field: TradeField; value: unknown; name: string }) {
  const id = `f-${f.name}`;
  const wide = f.type === "textarea" || f.type === "multiselect";
  const describedBy = f.help ? `${id}-help` : undefined;
  return (
    <div className={wide ? "space-y-2 sm:col-span-2" : "space-y-2"}>
      {f.type === "checkbox" ? (
        <div className="flex items-start gap-3">
          <Checkbox id={id} name={name} defaultChecked={Boolean(value)} aria-describedby={describedBy} />
          <div className="space-y-1">
            <Label htmlFor={id} className="font-normal">
              {f.label}
            </Label>
            {f.help && (
              <p id={`${id}-help`} className="text-xs text-muted-foreground">
                {f.help}
              </p>
            )}
          </div>
        </div>
      ) : f.type === "multiselect" ? (
        <fieldset aria-describedby={describedBy}>
          <legend className="mb-2 text-sm font-medium">
            {f.label}
            {f.required && <span aria-hidden="true"> *</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {f.options.map((o) => {
              const checked = Array.isArray(value) && (value as unknown[]).includes(o.value);
              return (
                <label key={o.value} className="cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary">
                  <input type="checkbox" name={name} value={o.value} defaultChecked={checked} className="sr-only" />
                  {o.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <>
          <Label htmlFor={id}>
            {f.label}
            {f.required && <span aria-hidden="true"> *</span>}
          </Label>
          {f.type === "textarea" ? (
            <Textarea id={id} name={name} defaultValue={typeof value === "string" ? value : ""} placeholder={f.placeholder} maxLength={f.maxLength} rows={3} aria-describedby={describedBy} />
          ) : f.type === "select" ? (
            <select id={id} name={name} defaultValue={typeof value === "string" ? value : ""} className="h-9 w-full rounded-lg border bg-background px-3 text-sm" aria-describedby={describedBy}>
              <option value="">Choisir</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "number" ? (
            <div className="flex items-center gap-2">
              <Input id={id} name={name} type="number" inputMode="numeric" min={f.min} max={f.max} defaultValue={value === null || value === undefined ? "" : String(value)} aria-describedby={describedBy} className="max-w-40" />
              {f.unit && <span className="text-sm text-muted-foreground">{f.unit}</span>}
            </div>
          ) : (
            <Input id={id} name={name} defaultValue={typeof value === "string" ? value : ""} placeholder={f.placeholder} maxLength={f.maxLength} aria-describedby={describedBy} />
          )}
        </>
      )}
      {f.help && f.type !== "checkbox" && (
        <p id={`${id}-help`} className="text-xs text-muted-foreground">
          {f.help}
        </p>
      )}
      <FieldErrorText name={f.name} />
    </div>
  );
}
