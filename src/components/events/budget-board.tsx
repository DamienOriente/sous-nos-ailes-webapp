"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Receipt, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { FileUpload } from "@/components/files/file-upload";
import { BudgetScene } from "@/components/illustrations/event-scenes";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormMessage } from "@/components/shared/form-message";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionResult } from "@/lib/errors";
import { cn, formatEuros } from "@/lib/utils";
import type { BudgetSummary } from "@/modules/events/domain/budget";
import type { BudgetTemplateLine } from "@/modules/events/domain/suggestions";
import { privateFileHref } from "@/modules/files/application/file-urls";

export type ExpenseItem = { id: string; label: string; amountCents: number; status: "planned" | "committed" | "paid"; budgetLineId: string | null; lineLabel: string | null; paidAt: string | null; receiptFileId: string | null };
type Actions = {
  createLine: (eventId: string, input: unknown) => Promise<ActionResult<{ id: string }>>;
  updateLine: (eventId: string, lineId: string, input: unknown) => Promise<ActionResult>;
  deleteLine: (eventId: string, lineId: string) => Promise<ActionResult>;
  createExpense: (eventId: string, input: unknown) => Promise<ActionResult<{ id: string }>>;
  updateExpense: (eventId: string, expenseId: string, input: unknown) => Promise<ActionResult>;
  deleteExpense: (eventId: string, expenseId: string) => Promise<ActionResult>;
  /** Creates the indicative "budget type" lines for real (computed from the guests and the provider slots). */
  applyTemplate?: (eventId: string) => Promise<ActionResult<{ created: number }>>;
};

const EXPENSE_STATUS = { planned: "Prévue", committed: "Engagée", paid: "Payée" } as const;
const EXPENSE_TONE = { planned: "neutral", committed: "warning", paid: "success" } as const;

export function BudgetBoard({ eventId, summary, expenses, providers, canManage, template, templateLabel, actions }: { eventId: string; summary: BudgetSummary; expenses: ExpenseItem[]; providers: Array<{ id: string; label: string; quoteCents: number | null }>; canManage: boolean; /** Lines the template chip would create (empty = nothing to suggest). */ template?: BudgetTemplateLine[]; templateLabel?: string; actions: Actions }) {
  const router = useRouter();
  const [pendingTemplate, startTemplate] = useTransition();
  const templateTotal = (template ?? []).reduce((s, l) => s + l.plannedCents, 0);
  const hasAmounts = summary.lines.some((l) => l.plannedCents > 0);
  function applyTemplate() {
    if (!actions.applyTemplate) return;
    startTemplate(async () => {
      const res = await actions.applyTemplate!(eventId);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(res.data.created ? `${res.data.created} poste${res.data.created > 1 ? "s" : ""} de budget ajouté${res.data.created > 1 ? "s" : ""}. Ajustez les montants à votre situation.` : "Rien à ajouter : vos postes couvrent déjà ces catégories.");
        router.refresh();
      }
    });
  }
  const templateChip = canManage && actions.applyTemplate && template && template.length > 0 && (
    <Button variant="outline" size="sm" onClick={applyTemplate} disabled={pendingTemplate} data-testid="apply-budget-template" title={`${template.length} postes, environ ${formatEuros(templateTotal)} — montants indicatifs à ajuster`}>
      <Sparkles className="size-3.5" aria-hidden="true" />
      {templateLabel ?? "Budget type"} · {formatEuros(templateTotal)}
    </Button>
  );
  const [lineDialog, setLineDialog] = useState<BudgetSummary["lines"][number] | "new" | null>(null);
  const [expenseDialog, setExpenseDialog] = useState<ExpenseItem | "new" | null>(null);
  const max = Math.max(1, ...summary.lines.map((l) => Math.max(l.plannedCents, l.committedCents)));

  return (
    <div className="space-y-8">
      <section aria-labelledby="chart" className="space-y-3 rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 id="chart" className="text-lg font-semibold">
            Prévu vs engagé par poste
          </h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-primary/30" aria-hidden="true" /> Prévu
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" /> Engagé
            </span>
          </div>
        </div>
        {summary.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ajoutez des postes de budget pour voir le graphique.</p>
        ) : (
          <ul className="space-y-3">
            {summary.lines.map((l) => (
              <li key={l.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{l.label}</span>
                  <span className={cn("tabular-nums", l.isOverrun && "font-medium text-destructive")}>
                    {formatEuros(l.committedCents)} / {formatEuros(l.plannedCents)}
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${l.label} : prévu ${formatEuros(l.plannedCents)}, engagé ${formatEuros(l.committedCents)}`}>
                  <div className="absolute inset-y-0 left-0 rounded-full bg-primary/30" style={{ width: `${Math.round((l.plannedCents / max) * 100)}%` }} />
                  <div className={cn("absolute inset-y-0 left-0 rounded-full", l.isOverrun ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.round((l.committedCents / max) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="lines" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="lines" className="text-lg font-semibold">
            Postes de budget
          </h2>
          {canManage && summary.lines.length > 0 && hasAmounts && (
            <div className="flex flex-wrap items-center gap-2">
              {templateChip}
              <Button size="sm" onClick={() => setLineDialog("new")}>
                <Plus className="size-3.5" aria-hidden="true" />
                Ajouter un poste
              </Button>
            </div>
          )}
        </div>
        {summary.lines.length === 0 || !hasAmounts ? (
          <IllustratedEmpty
            scene={BudgetScene}
            title={summary.lines.length === 0 ? "Aucun poste de budget" : "Vos postes n'ont pas encore de montant"}
            description="Un poste = ce que vous prévoyez de dépenser (lieu, traiteur, enfants, photo…). Les dépenses viennent ensuite s'y rattacher pour suivre l'engagé, le payé et l'écart."
            example="Traiteur — Cocktail + dîner 120 couverts : 12 000 €"
            action={canManage ? <>{templateChip}<Button size="sm" onClick={() => setLineDialog("new")}><Plus className="size-3.5" aria-hidden="true" />Ajouter un poste</Button></> : undefined}
            testId="budget-empty"
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Catégorie</th>
                  <th className="px-4 py-2 font-medium">Libellé</th>
                  <th className="px-4 py-2 text-right font-medium">Prévu</th>
                  <th className="px-4 py-2 text-right font-medium">Engagé</th>
                  <th className="px-4 py-2 text-right font-medium">Payé</th>
                  <th className="px-4 py-2 text-right font-medium">Écart</th>
                  {canManage && <th className="px-2 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 text-muted-foreground">{l.category}</td>
                    <td className="px-4 py-2 font-medium">
                      {l.label}
                      {l.eventProfessionalId && <span className="ml-2 text-xs font-normal text-muted-foreground">devis lié</span>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatEuros(l.plannedCents)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatEuros(l.committedCents)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatEuros(l.paidCents)}</td>
                    <td className={cn("px-4 py-2 text-right tabular-nums", l.isOverrun ? "font-medium text-destructive" : "text-success")}>
                      {l.varianceCents < 0 ? "−" : ""}
                      {formatEuros(Math.abs(l.varianceCents))}
                    </td>
                    {canManage && (
                      <td className="px-2 py-1">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => setLineDialog(l)} aria-label={`Modifier ${l.label}`}>
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${l.label}`}>
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </Button>
                            }
                            title="Supprimer ce poste ?"
                            description="Les dépenses associées seront conservées mais détachées du poste."
                            confirmLabel="Supprimer"
                            onConfirm={async () => {
                              const res = await actions.deleteLine(eventId, l.id);
                              if (res.ok) router.refresh();
                              return res;
                            }}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="expenses" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="expenses" className="text-lg font-semibold">
            Dépenses
          </h2>
          {canManage && expenses.length > 0 && (
            <Button size="sm" onClick={() => setExpenseDialog("new")}>
              <Plus className="size-3.5" aria-hidden="true" />
              Ajouter une dépense
            </Button>
          )}
        </div>
        {expenses.length === 0 ? (
          <IllustratedEmpty
            scene={BudgetScene}
            compact
            title="Aucune dépense saisie"
            description="Acomptes, factures, achats : chaque dépense est « engagée » (due) ou « payée », avec un justificatif si vous le souhaitez."
            example="Acompte domaine (30 %) — 2 550 €, payé le 15 septembre"
            action={canManage ? <Button size="sm" onClick={() => setExpenseDialog("new")}><Receipt className="size-3.5" aria-hidden="true" />Ajouter une dépense</Button> : undefined}
          />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.lineLabel ?? "Hors poste"}
                    {e.paidAt ? ` · payée le ${new Date(e.paidAt).toLocaleDateString("fr-FR")}` : ""}
                    {e.receiptFileId && (
                      <>
                        {" · "}
                        <a href={privateFileHref(e.receiptFileId)} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                          justificatif
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <StatusBadge tone={EXPENSE_TONE[e.status]}>{EXPENSE_STATUS[e.status]}</StatusBadge>
                <span className="w-24 text-right tabular-nums">{formatEuros(e.amountCents)}</span>
                {canManage && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => setExpenseDialog(e)} aria-label={`Modifier ${e.label}`}>
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${e.label}`}>
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      }
                      title="Supprimer cette dépense ?"
                      description="Cette action est définitive."
                      confirmLabel="Supprimer"
                      onConfirm={async () => {
                        const res = await actions.deleteExpense(eventId, e.id);
                        if (res.ok) router.refresh();
                        return res;
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <LineDialog eventId={eventId} item={lineDialog} providers={providers} onClose={() => setLineDialog(null)} actions={actions} />
      <ExpenseDialog eventId={eventId} item={expenseDialog} lines={summary.lines.map((l) => ({ id: l.id, label: l.label }))} onClose={() => setExpenseDialog(null)} actions={actions} />
    </div>
  );
}

function LineDialog({ eventId, item, providers, onClose, actions }: { eventId: string; item: BudgetSummary["lines"][number] | "new" | null; providers: Array<{ id: string; label: string; quoteCents: number | null }>; onClose: () => void; actions: Actions }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const l = item === "new" ? null : item;
  const [provider, setProvider] = useState<string>("none");
  const [forKey, setForKey] = useState<string | null>(null);
  const key = l?.id ?? (item ? "new" : null);
  if (key !== forKey) {
    setForKey(key);
    setProvider(l?.eventProfessionalId ?? "none");
  }
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const planned = String(fd.get("planned") ?? "0").replace(",", ".");
    const input = { category: fd.get("category"), label: fd.get("label"), plannedCents: Math.round(Number.parseFloat(planned || "0") * 100), eventProfessionalId: provider === "none" ? null : provider };
    start(async () => {
      const res = l ? await actions.updateLine(eventId, l.id, input) : await actions.createLine(eventId, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      toast.success(l ? "Poste mis à jour." : "Poste ajouté.");
      onClose();
      router.refresh();
    });
  }
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{l ? "Modifier le poste" : "Nouveau poste de budget"}</DialogTitle>
          <DialogDescription>Le montant prévu sert de référence pour calculer les écarts.</DialogDescription>
        </DialogHeader>
        <form key={key ?? "closed"} onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bl-cat">Catégorie</Label>
              <Input id="bl-cat" name="category" defaultValue={l?.category ?? ""} required maxLength={80} placeholder="Lieu, Traiteur, Enfants…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bl-label">Libellé</Label>
              <Input id="bl-label" name="label" defaultValue={l?.label ?? ""} required maxLength={160} placeholder="Cocktail + dîner 120 couverts" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bl-planned">Prévu (€)</Label>
              <Input id="bl-planned" name="planned" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={l ? (l.plannedCents / 100).toString() : ""} required placeholder="12 000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bl-pro">Devis lié</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="bl-pro">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                      {p.quoteCents !== null ? ` — ${formatEuros(p.quoteCents)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <FormMessage error={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDialog({ eventId, item, lines, onClose, actions }: { eventId: string; item: ExpenseItem | "new" | null; lines: Array<{ id: string; label: string }>; onClose: () => void; actions: Actions }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const e = item === "new" ? null : item;
  const key = e?.id ?? (item ? "new" : null);
  const [forKey, setForKey] = useState<string | null>(null);
  const [line, setLine] = useState("none");
  const [status, setStatus] = useState<ExpenseItem["status"]>("committed");
  const [receipt, setReceipt] = useState<string | null>(null);
  if (key !== forKey) {
    setForKey(key);
    setLine(e?.budgetLineId ?? "none");
    setStatus(e?.status ?? "committed");
    setReceipt(e?.receiptFileId ?? null);
  }
  function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const amount = String(fd.get("amount") ?? "0").replace(",", ".");
    const input = { budgetLineId: line === "none" ? null : line, label: fd.get("label"), amountCents: Math.round(Number.parseFloat(amount || "0") * 100), status, paidAt: String(fd.get("paidAt") ?? "") || null, receiptFileId: receipt };
    start(async () => {
      const res = e ? await actions.updateExpense(eventId, e.id, input) : await actions.createExpense(eventId, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      toast.success(e ? "Dépense mise à jour." : "Dépense ajoutée.");
      onClose();
      router.refresh();
    });
  }
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{e ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
          <DialogDescription>« Engagée » = somme due (devis signé, acompte à verser) ; « Payée » = réglée.</DialogDescription>
        </DialogHeader>
        <form key={key ?? "closed"} onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ex-label">Libellé</Label>
              <Input id="ex-label" name="label" defaultValue={e?.label ?? ""} required maxLength={160} placeholder="Acompte traiteur (30 %)" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-amount">Montant (€)</Label>
              <Input id="ex-amount" name="amount" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={e ? (e.amountCents / 100).toString() : ""} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-line">Poste</Label>
              <Select value={line} onValueChange={setLine}>
                <SelectTrigger id="ex-line">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Hors poste</SelectItem>
                  {lines.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-status">Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ExpenseItem["status"])}>
                <SelectTrigger id="ex-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Prévue</SelectItem>
                  <SelectItem value="committed">Engagée</SelectItem>
                  <SelectItem value="paid">Payée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {status === "paid" && (
              <div className="space-y-1.5">
                <Label htmlFor="ex-paid">Payée le</Label>
                <Input id="ex-paid" name="paidAt" type="date" defaultValue={e?.paidAt ?? new Date().toISOString().slice(0, 10)} />
              </div>
            )}
          </div>
          <div className="space-y-2 rounded-xl border p-3">
            <p className="text-sm font-medium">Justificatif</p>
            {receipt ? (
              <div className="flex items-center justify-between text-sm">
                <a href={privateFileHref(receipt)} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                  Ouvrir le justificatif
                </a>
                <Button type="button" variant="ghost" size="sm" onClick={() => setReceipt(null)}>
                  Retirer
                </Button>
              </div>
            ) : (
              <FileUpload scope="event" scopeId={eventId} purpose="receipt" maxFiles={1} onUploaded={(f) => setReceipt(f.id)} />
            )}
          </div>
          <FormMessage error={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
