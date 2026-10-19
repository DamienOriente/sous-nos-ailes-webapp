import Link from "next/link";
import { Download } from "lucide-react";
import { BudgetBoard } from "@/components/events/budget-board";
import { Paywall } from "@/components/billing/paywall";
import { PageHeader, StatCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { requireActor } from "@/lib/session";
import { formatEuros } from "@/lib/utils";
import { hasFeature } from "@/modules/billing/application/entitlements";
import { getBudget, previewBudgetTemplate } from "@/modules/events/application/budget-service";
import { getEventForMember } from "@/modules/events/application/event-service";
import { PROVIDER_STATUS_LABELS } from "@/modules/events/domain/providers";
import { budgetTemplateLabel } from "@/modules/events/domain/suggestions";
import { guardPage } from "../_guards";
import { HoldActionButton } from "@/components/brief/hold-buttons";
import { StatusBadge } from "@/components/shared/status-badge";
import { listPaymentItems } from "@/modules/events/application/payment-service";
import { PAYMENT_STATE_LABELS } from "@/modules/events/domain/payment-schedule";
import { markPaymentPaidAction } from "./actions";
import { applyBudgetTemplateAction, createBudgetLineAction, createExpenseAction, deleteBudgetLineAction, deleteExpenseAction, updateBudgetLineAction, updateExpenseAction } from "./actions";

export default async function BudgetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vue?: string }> }) {
  const { id } = await params;
  const { vue } = await searchParams;
  const actor = await requireActor(`/app/evenements/${id}/budget`);
  const { event, budget, payments } = await guardPage(async () => {
    const event = await getEventForMember(actor, id);
    const budget = await getBudget(actor, id);
    const payments = await listPaymentItems(actor, id);
    return { event, budget, payments };
  });
  const advanced = await hasFeature(actor.userId, "organizer", "budget.advanced");
  const template = budget.canManage ? await previewBudgetTemplate(actor, id) : [];
  const base = `/app/evenements/${id}/budget`;
  const s = budget.summary;

  if (vue === "comparaison" && !advanced) {
    return (
      <Paywall
        feature="budget.advanced"
        audience="organizer"
        description="Comparez les devis côte à côte par catégorie, exportez le budget en CSV et suivez les écarts poste par poste."
        backHref={base}
        preview={
          <div className="grid grid-cols-3 gap-2 p-4 text-xs text-muted-foreground">
            {["Traiteur A : 4 200 €", "Traiteur B : 3 950 €", "Traiteur C : 4 600 €"].map((x) => (
              <div key={x} className="rounded-lg border bg-background p-3">
                {x}
              </div>
            ))}
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        description={event.budgetCents ? `Enveloppe indicative : ${formatEuros(event.budgetCents)}.` : "Prévu par poste, engagé et payé, avec les écarts."}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/app/evenements/${id}/devis`}>Comparer les devis</Link>
            </Button>
            {advanced ? (
              <Button asChild variant="outline">
                <a href={`${base}/export`}>
                  <Download className="size-4" aria-hidden="true" />
                  Export CSV
                </a>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href={`${base}?vue=comparaison`}>
                  Export CSV (Premium)
                </Link>
              </Button>
            )}
          </>
        }
      />
      <section aria-label="Totaux" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Prévu" value={formatEuros(s.plannedCents)} hint={`${s.lines.length} poste${s.lines.length > 1 ? "s" : ""}`} />
        <StatCard label="Engagé" value={formatEuros(s.committedCents)} hint={s.plannedCents > 0 ? `${s.committedRatio}% du prévu` : undefined} />
        <StatCard label="Payé" value={formatEuros(s.paidCents)} hint={`Reste à payer ${formatEuros(Math.max(0, s.committedCents - s.paidCents))}`} />
        <StatCard label="Écart" value={`${s.remainingCents < 0 ? "−" : ""}${formatEuros(Math.abs(s.remainingCents))}`} hint={s.remainingCents < 0 ? "Dépassement" : "Marge restante"} />
      </section>
      <section id="echeancier" aria-labelledby="echeancier-h" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="echeancier-h" className="text-lg font-semibold">
            Échéancier des paiements
          </h2>
          {payments.items.length > 0 && <p className="text-sm text-muted-foreground">Reste à régler : {formatEuros(payments.remainingCents)}</p>}
        </div>
        {payments.items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-pretty">Quand vous acceptez un devis, son acompte et son solde s'ajoutent ici avec leurs dates. Vous êtes prévenu une semaine avant chaque échéance. Les paiements se font directement auprès des professionnels.</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card" data-testid="payment-schedule">
            {payments.items.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {p.payeeName}
                    <span className="font-normal text-muted-foreground">, {p.label.toLowerCase()}</span>
                  </p>
                  <p className="text-muted-foreground">
                    {formatEuros(p.amountCents)}, {p.paidAt ? `payé le ${new Date(`${p.paidAt}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" })}` : `à régler le ${new Date(`${p.dueDate}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={p.state === "paid" ? "success" : p.state === "overdue" ? "danger" : p.state === "due_soon" ? "warning" : "neutral"}>{PAYMENT_STATE_LABELS[p.state]}</StatusBadge>
                  {payments.canManage && (p.paidAt ? <HoldActionButton run={markPaymentPaidAction.bind(null, id, p.id, false)} label="Annuler" done="Paiement remis à régler." /> : <HoldActionButton run={markPaymentPaidAction.bind(null, id, p.id, true)} label="Marquer payé" done="Paiement enregistré." variant="default" />)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {vue === "comparaison" ? (
        <QuoteComparison providers={budget.providers} backHref={base} />
      ) : (
        <BudgetBoard
          eventId={id}
          summary={s}
          expenses={budget.expenses.map((e) => ({ id: e.id, label: e.label, amountCents: e.amountCents, status: e.status, budgetLineId: e.budgetLineId, lineLabel: e.lineLabel, paidAt: e.paidAt, receiptFileId: e.receiptFileId }))}
          providers={budget.providers}
          canManage={budget.canManage}
          template={template}
          templateLabel={budgetTemplateLabel(event.expectedGuests)}
          actions={{ createLine: createBudgetLineAction, updateLine: updateBudgetLineAction, deleteLine: deleteBudgetLineAction, createExpense: createExpenseAction, updateExpense: updateExpenseAction, deleteExpense: deleteExpenseAction, applyTemplate: applyBudgetTemplateAction }}
        />
      )}
    </div>
  );
}

function QuoteComparison({ providers, backHref }: { providers: Array<{ id: string; label: string; quoteCents: number | null; status: string }>; backHref: string }) {
  const quoted = providers.filter((p) => p.quoteCents !== null).sort((a, b) => (a.quoteCents ?? 0) - (b.quoteCents ?? 0));
  const max = Math.max(1, ...quoted.map((p) => p.quoteCents ?? 0));
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Devis côte à côte</h2>
        <Link href={backHref} className="text-sm text-primary hover:underline">
          Retour au budget
        </Link>
      </div>
      {quoted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun devis saisi pour l'instant. Renseignez le montant sur la fiche de chaque prestataire.</p>
      ) : (
        <ul className="space-y-3">
          {quoted.map((p) => (
            <li key={p.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{p.label}</span>
                <span className="tabular-nums">{formatEuros(p.quoteCents ?? 0)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(((p.quoteCents ?? 0) / max) * 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{PROVIDER_STATUS_LABELS[p.status as keyof typeof PROVIDER_STATUS_LABELS] ?? p.status}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
