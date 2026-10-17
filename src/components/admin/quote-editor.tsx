"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
import { saveAndSendDraftAction, saveDraftAction, withdrawDraftAction } from "@/server/actions/admin/quotes";
import { idleState } from "@/server/action-state";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { SubmitButton } from "@/components/admin/submit-button";
import { Disclosure, HelpText } from "@/components/admin/section";
import { LINE_KIND_LABELS } from "@/components/admin/badges";
import { lineTotal, totalsFromLines, type LineKind } from "@/domain/pricing";
import { centsToEuroInput, formatEuros, parseEurosToCents } from "@/lib/money";
import type { QuoteLineKind, QuoteVersionStatus, VatMode } from "@/generated/prisma/enums";

export type QuoteEditorProps = {
  eventId: string;
  versionId: string;
  version: {
    number: number;
    status: QuoteVersionStatus;
    title: string;
    introText: string | null;
    validUntil: string | null;
    vatMode: VatMode;
    vatRateBps: number;
    lines: Array<{ kind: QuoteLineKind; label: string; description: string | null; quantityHundredths: number; unitPriceCents: number }>;
  };
  previewHref: string;
  eventHref: string;
};

type EditableLine = { key: string; kind: LineKind; label: string; description: string; quantity: string; unitPrice: string };

const LINE_KINDS: LineKind[] = ["SERVICE", "TRAVEL", "OPTION", "SURCHARGE", "DISCOUNT", "OTHER"];

/** "2,5" (hours or units) → 250 hundredths: the same arithmetic as euros → cents. */
const toHundredths = parseEurosToCents;

function fromHundredths(value: number): string {
  return centsToEuroInput(value);
}

/** Initial lines are keyed by index so the server and client renders agree. */
function toEditable(line: QuoteEditorProps["version"]["lines"][number], index: number): EditableLine {
  return { key: `line-${index}`, kind: line.kind, label: line.label, description: line.description ?? "", quantity: fromHundredths(line.quantityHundredths), unitPrice: centsToEuroInput(line.unitPriceCents) };
}

function parsedLine(line: EditableLine): { quantityHundredths: number | null; unitPriceCents: number | null } {
  return { quantityHundredths: toHundredths(line.quantity), unitPriceCents: parseEurosToCents(line.unitPrice) };
}

export function QuoteEditor({ eventId, versionId, version, previewHref, eventHref }: QuoteEditorProps) {
  const [state, action] = useActionState(saveDraftAction.bind(null, versionId, eventId), idleState);
  const [title, setTitle] = useState(version.title);
  const [introText, setIntroText] = useState(version.introText ?? "");
  const [validUntil, setValidUntil] = useState(version.validUntil ?? "");
  const [vatMode, setVatMode] = useState<VatMode>(version.vatMode);
  const [vatRatePercent, setVatRatePercent] = useState(centsToEuroInput(version.vatRateBps));
  const [lines, setLines] = useState<EditableLine[]>(() => version.lines.map(toEditable));
  // Lines added in the browser continue the index sequence.
  const nextIndexRef = useRef(version.lines.length);
  const [localError, setLocalError] = useState<string | null>(null);

  const isDraft = version.status === "DRAFT";

  const parsed = useMemo(() => lines.map(parsedLine), [lines]);
  const allValid = parsed.every((p) => p.quantityHundredths !== null && p.quantityHundredths > 0 && p.unitPriceCents !== null);
  const vatBps = parseEurosToCents(vatRatePercent) ?? 0;
  const totals = useMemo(
    () =>
      totalsFromLines(
        lines.map((line, index) => ({ kind: line.kind, quantityHundredths: parsed[index].quantityHundredths ?? 0, unitPriceCents: parsed[index].unitPriceCents ?? 0 })),
        vatMode,
        vatBps,
      ),
    [lines, parsed, vatMode, vatBps],
  );
  const linesJson = useMemo(
    () =>
      JSON.stringify(
        lines.map((line, index) => ({
          kind: line.kind,
          label: line.label,
          description: line.description.trim() ? line.description.trim() : null,
          quantityHundredths: parsed[index].quantityHundredths,
          unitPriceCents: parsed[index].unitPriceCents,
        })),
      ),
    [lines, parsed],
  );

  function updateLine(key: string, patch: Partial<EditableLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine() {
    const lineKey = `line-${nextIndexRef.current}`;
    nextIndexRef.current += 1;
    setLines((current) => [...current, { key: lineKey, kind: "OTHER", label: "", description: "", quantity: "1,00", unitPrice: "0,00" }]);
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function guard(event: FormEvent<HTMLFormElement>) {
    if (!lines.length) {
      event.preventDefault();
      setLocalError("Ajoutez au moins une ligne.");
      return;
    }
    if (!allValid) {
      event.preventDefault();
      setLocalError("Certaines quantités ou prix sont invalides (format attendu : 2,50).");
      return;
    }
    setLocalError(null);
  }

  if (!isDraft) {
    return (
      <div className="flex flex-col gap-5">
        <Alert kind="info" role="status" title="Version transmise, donc immuable.">
          Une version envoyée au client ne se modifie plus : elle reste dans l’historique. Pour ajuster la proposition, préparez une nouvelle version depuis la fiche de l’événement.
        </Alert>
        <Table>
          <thead>
            <tr>
              <Th>Type</Th>
              <Th>Désignation</Th>
              <Th className="text-right">Quantité</Th>
              <Th className="text-right">Prix unitaire</Th>
              <Th className="text-right">Montant</Th>
            </tr>
          </thead>
          <tbody>
            {version.lines.map((line, index) => (
              <tr key={index}>
                <Td className="text-ink-500">{LINE_KIND_LABELS[line.kind]}</Td>
                <Td>
                  <span className="font-medium">{line.label}</span>
                  {line.description ? <span className="block text-[13px] text-ink-500">{line.description}</span> : null}
                </Td>
                <Td className="text-right tabular">{fromHundredths(line.quantityHundredths)}</Td>
                <Td className="text-right tabular">{formatEuros(line.unitPriceCents)}</Td>
                <Td className="text-right tabular">{formatEuros(lineTotal(line.quantityHundredths, line.unitPriceCents))}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="flex flex-wrap gap-2">
          <Link href={previewHref} className={buttonClasses({ variant: "secondary" })}>
            Voir le document
          </Link>
          <Link href={eventHref} className={buttonClasses({ variant: "ghost" })}>
            Retour à l’événement
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={action} onSubmit={guard} className="flex flex-col gap-6" noValidate>
        <input type="hidden" name="linesJson" value={linesJson} readOnly />
        {state.status === "success" ? <Alert kind="success" role="status">{state.message}</Alert> : null}
        {state.status === "error" ? <Alert kind="danger" role="alert">{state.message}</Alert> : null}
        {localError ? <Alert kind="danger" role="alert">{localError}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titre de la proposition" htmlFor="quote-title" error={state.fieldErrors?.title} required className="sm:col-span-2">
            <Input id="quote-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required invalid={Boolean(state.fieldErrors?.title)} />
          </Field>
          <Field label="Texte d’introduction" htmlFor="quote-intro" error={state.fieldErrors?.introText} optionalLabel className="sm:col-span-2">
            <Textarea id="quote-intro" name="introText" value={introText} onChange={(e) => setIntroText(e.target.value)} maxLength={2000} invalid={Boolean(state.fieldErrors?.introText)} />
          </Field>
          <Field label="Valable jusqu’au" htmlFor="quote-validUntil" error={state.fieldErrors?.validUntil} optionalLabel>
            <Input id="quote-validUntil" name="validUntil" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} invalid={Boolean(state.fieldErrors?.validUntil)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="TVA" htmlFor="quote-vatMode" error={state.fieldErrors?.vatMode} required>
              <Select id="quote-vatMode" name="vatMode" value={vatMode} onChange={(e) => setVatMode(e.target.value as VatMode)}>
                <option value="NONE">Aucune (à confirmer)</option>
                <option value="STANDARD">Assujetti</option>
              </Select>
            </Field>
            <Field label="Taux de TVA (%)" htmlFor="quote-vatRate" error={state.fieldErrors?.vatRateBps}>
              <Input id="quote-vatRate" name="vatRatePercent" inputMode="decimal" value={vatRatePercent} onChange={(e) => setVatRatePercent(e.target.value)} disabled={vatMode === "NONE"} invalid={Boolean(state.fieldErrors?.vatRateBps)} />
            </Field>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3 className="font-sans text-[15px] font-semibold text-ink-900">Lignes</h3>
            <Button type="button" variant="secondary" size="sm" onClick={addLine}>
              Ajouter une ligne
            </Button>
          </div>
          {state.fieldErrors?.lines ? (
            <p role="alert" className="text-sm font-medium text-danger-600">
              {state.fieldErrors.lines.join(" ")}
            </p>
          ) : null}
          <Table>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Désignation et précision</Th>
                <Th className="text-right">Quantité</Th>
                <Th className="text-right">Prix unitaire (€)</Th>
                <Th className="text-right">Montant</Th>
                <Th>
                  <span className="sr-only">Retirer</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const p = parsed[index];
                const quantityInvalid = p.quantityHundredths === null || p.quantityHundredths <= 0;
                const priceInvalid = p.unitPriceCents === null;
                const n = index + 1;
                return (
                  <tr key={line.key}>
                    <Td className="min-w-36">
                      <Select aria-label={`Type de la ligne ${n}`} value={line.kind} onChange={(e) => updateLine(line.key, { kind: e.target.value as LineKind })}>
                        {LINE_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {LINE_KIND_LABELS[kind]}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td className="min-w-64">
                      <div className="flex flex-col gap-2">
                        <Input aria-label={`Désignation de la ligne ${n}`} value={line.label} onChange={(e) => updateLine(line.key, { label: e.target.value })} maxLength={160} placeholder="Désignation" />
                        <Input aria-label={`Précision de la ligne ${n}`} value={line.description} onChange={(e) => updateLine(line.key, { description: e.target.value })} maxLength={300} placeholder="Précision (facultatif)" className="text-sm" />
                      </div>
                    </Td>
                    <Td className="min-w-28">
                      <Input aria-label={`Quantité de la ligne ${n}`} inputMode="decimal" value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} invalid={quantityInvalid} className="text-right tabular" />
                    </Td>
                    <Td className="min-w-32">
                      <Input aria-label={`Prix unitaire de la ligne ${n}`} inputMode="decimal" value={line.unitPrice} onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })} invalid={priceInvalid} className="text-right tabular" />
                    </Td>
                    <Td className="text-right tabular whitespace-nowrap">{quantityInvalid || priceInvalid ? "—" : formatEuros(totals.lineTotals[index])}</Td>
                    <Td>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(line.key)} aria-label={`Retirer la ligne ${n}`}>
                        Retirer
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <HelpText>Quantités en heures cumulées ou en unités (deux décimales), prix en euros. Les remises se saisissent avec le type « Remise » et un prix négatif ou positif : le serveur recalcule tous les totaux.</HelpText>
        </div>

        <dl className="ml-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[15px]">
          <dt className="text-ink-500">Sous-total</dt>
          <dd className="text-right tabular">{formatEuros(totals.subtotalCents)}</dd>
          {totals.discountCents > 0 ? (
            <>
              <dt className="text-ink-500">Remise</dt>
              <dd className="text-right tabular">− {formatEuros(totals.discountCents)}</dd>
            </>
          ) : null}
          {vatMode === "STANDARD" ? (
            <>
              <dt className="text-ink-500">Total HT</dt>
              <dd className="text-right tabular">{formatEuros(totals.totalExclVatCents)}</dd>
              <dt className="text-ink-500">TVA</dt>
              <dd className="text-right tabular">{formatEuros(totals.vatCents)}</dd>
            </>
          ) : null}
          <dt className="border-t border-sage-300 pt-2 font-semibold">{vatMode === "STANDARD" ? "Total TTC" : "Total"}</dt>
          <dd className="border-t border-sage-300 pt-2 text-right font-semibold tabular">{formatEuros(totals.totalInclVatCents)}</dd>
        </dl>
        <HelpText className="text-right">Aperçu indicatif : les montants définitifs sont recalculés à l’enregistrement.</HelpText>

        <div className="flex flex-col gap-3 border-t border-sage-200 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
          <SubmitButton label="Enregistrer le brouillon" />
          <Link href={previewHref} className={buttonClasses({ variant: "secondary" })}>
            Prévisualiser
          </Link>
          <Link href={eventHref} className={buttonClasses({ variant: "ghost" })}>
            Retour à l’événement
          </Link>
        </div>

        <Disclosure summary="Transmettre au client">
          <div className="flex flex-col gap-3">
            <HelpText>
              Enregistre les modifications en cours, fige cette version {version.number}, remplace l’éventuelle version courante et envoie au client un email avec un lien vers son espace. Le client donne ensuite un accord de principe (pas une signature électronique).
            </HelpText>
            <div>
              <Button type="submit" variant="sage" formAction={saveAndSendDraftAction.bind(null, versionId, eventId)}>
                Transmettre la version {version.number} au client
              </Button>
            </div>
          </div>
        </Disclosure>
      </form>

      <Disclosure summary="Supprimer le brouillon">
        <form action={withdrawDraftAction.bind(null, versionId, eventId)} className="flex flex-col gap-3">
          <HelpText>Le brouillon est supprimé définitivement ; les versions déjà transmises restent dans l’historique.</HelpText>
          <div>
            <SubmitButton label="Supprimer ce brouillon" pendingLabel="Suppression…" variant="danger" />
          </div>
        </form>
      </Disclosure>
    </div>
  );
}
