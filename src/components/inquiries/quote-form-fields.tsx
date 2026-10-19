"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldErrorText } from "@/components/professionals/action-form";
import { formatEuros } from "@/lib/utils";
import { CANCELLATION_LABELS, CANCELLATION_POLICIES, type CancellationPolicy } from "@/modules/inquiries/domain/quote";

type Line = { key: number; label: string; quantity: string; unit: string };

const toNumber = (v: string) => {
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Quote in the common format. Detailed lines are optional: with lines, the total is their sum
 * (shown live); without, a single total is typed.
 */
export function QuoteFormFields({ guests }: { guests: number | null }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [policy, setPolicy] = useState<CancellationPolicy>("moderate");
  const [counter, setCounter] = useState(0);
  const total = lines.reduce((s, l) => s + Math.max(0, Math.trunc(toNumber(l.quantity))) * toNumber(l.unit), 0);
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const add = () => {
    setLines((ls) => [...ls, { key: counter, label: "", quantity: "1", unit: "" }]);
    setCounter((c) => c + 1);
  };
  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Prix</legend>
        {lines.length > 0 && (
          <ul className="space-y-2">
            {lines.map((l, i) => (
              <li key={l.key} className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_auto] items-end gap-2">
                <div className="space-y-1">
                  {i === 0 && <Label htmlFor={`line-label-${l.key}`}>Prestation</Label>}
                  <Input id={`line-label-${l.key}`} name={`line_label_${i}`} value={l.label} onChange={(e) => update(l.key, { label: e.target.value })} required maxLength={120} aria-label={`Ligne ${i + 1} : prestation`} />
                </div>
                <div className="space-y-1">
                  {i === 0 && <Label htmlFor={`line-qty-${l.key}`}>Quantité</Label>}
                  <Input id={`line-qty-${l.key}`} name={`line_qty_${i}`} inputMode="numeric" value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} aria-label={`Ligne ${i + 1} : quantité`} />
                </div>
                <div className="space-y-1">
                  {i === 0 && <Label htmlFor={`line-unit-${l.key}`}>Prix unitaire (€)</Label>}
                  <Input id={`line-unit-${l.key}`} name={`line_unit_${i}`} inputMode="decimal" value={l.unit} onChange={(e) => update(l.key, { unit: e.target.value })} aria-label={`Ligne ${i + 1} : prix unitaire`} />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Retirer la ligne ${i + 1}`}>
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-4">
          {lines.length === 0 ? (
            <div className="space-y-2">
              <Label htmlFor="quote-total">Montant total TTC (€)</Label>
              <Input id="quote-total" name="totalEuros" inputMode="decimal" placeholder="4500" className="w-40" />
              <FieldErrorText name="totalEuros" />
            </div>
          ) : (
            <p className="text-sm">
              Total TTC : <span className="font-semibold tabular-nums">{formatEuros(Math.round(total * 100))}</span>
              {guests ? <span className="text-muted-foreground">, soit {formatEuros(Math.round((total * 100) / guests))} par invité</span> : null}
            </p>
          )}
          <Button type="button" variant="outline" size="sm" onClick={add}>
            {lines.length ? "Ajouter une ligne" : "Détailler par lignes"}
          </Button>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quote-inclusions">Inclus (une ligne par élément)</Label>
          <Textarea id="quote-inclusions" name="inclusions" rows={4} placeholder={"Vaisselle et nappage\nService à table\nDéplacement"} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quote-exclusions">Non inclus (une ligne par élément)</Label>
          <Textarea id="quote-exclusions" name="exclusions" rows={4} placeholder={"Boissons\nHeures au-delà de 2 h du matin"} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quote-deposit">Acompte à la signature (€)</Label>
          <Input id="quote-deposit" name="depositEuros" inputMode="decimal" placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quote-balance">Solde dû (jours avant l'évènement)</Label>
          <Input id="quote-balance" name="balanceDueDays" type="number" min={0} max={365} placeholder="30" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quote-policy">Conditions d'annulation</Label>
          <select id="quote-policy" name="cancellationPolicy" value={policy} onChange={(e) => setPolicy(e.target.value as CancellationPolicy)} className="h-9 w-full rounded-lg border bg-background px-3 text-sm">
            {CANCELLATION_POLICIES.map((p) => (
              <option key={p} value={p}>
                {CANCELLATION_LABELS[p].label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground text-pretty">{CANCELLATION_LABELS[policy].description}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quote-valid">Devis valable jusqu'au</Label>
          <Input id="quote-valid" name="validUntil" type="date" />
          <FieldErrorText name="validUntil" />
        </div>
        {policy === "custom" && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="quote-terms">Vos conditions d'annulation</Label>
            <Textarea id="quote-terms" name="cancellationTerms" rows={3} maxLength={1500} />
            <FieldErrorText name="cancellationTerms" />
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="quote-note">Précisions</Label>
          <Textarea id="quote-note" name="note" rows={3} maxLength={2000} placeholder="Horaires, nombre d'intervenants, options possibles" />
        </div>
      </div>
    </div>
  );
}
