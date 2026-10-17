"use client";
import { useState } from "react";
import { ActionForm, ActionSubmit, type FormAction } from "@/components/admin/action-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DECISION_LABELS, type Decision } from "@/modules/moderation/domain/decisions";

const HINTS: Record<Decision, string> = {
  approve: "La fiche devient visible dans l'annuaire. Indiquez ce que vous avez vérifié.",
  reject: "La fiche est refusée ; le professionnel reçoit le motif et peut la corriger puis la soumettre à nouveau.",
  request_changes: "Le professionnel reçoit vos demandes. Une version déjà publiée reste en ligne.",
  suspend: "La fiche disparaît de l'annuaire immédiatement. Motif obligatoire, transmis au professionnel.",
  reinstate: "Remet en ligne une fiche suspendue.",
  dismiss: "Clôt le cas sans effet sur la fiche (signalement non fondé, doublon).",
  escalate: "Garde le cas ouvert et le signale à un administrateur.",
  note: "Note interne, jamais transmise au professionnel.",
};

export function DecisionForm({ caseId, action, allowed }: { caseId: string; action: FormAction; allowed: Decision[] }) {
  const [decision, setDecision] = useState<Decision>(allowed[0] ?? "note");
  return (
    <ActionForm action={action} successMessage="Décision enregistrée." resetOnSuccess>
      <input type="hidden" name="caseId" value={caseId} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Décision</legend>
        <div className="flex flex-wrap gap-2">
          {allowed.map((d) => (
            <label key={d} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${decision === d ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted"}`}>
              <input type="radio" name="decision" value={d} checked={decision === d} onChange={() => setDecision(d)} className="sr-only" />
              {DECISION_LABELS[d]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{HINTS[decision]}</p>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor={`reason-${caseId}`}>Motif (transmis au professionnel sauf note interne)</Label>
        <Textarea id={`reason-${caseId}`} name="reason" required minLength={10} rows={4} placeholder="Ex. : SIRET rapproché de l'avis de situation SIRENE du 12/09, description conforme, photos adaptées." />
      </div>
      <ActionSubmit pendingLabel="Enregistrement…" variant={decision === "reject" || decision === "suspend" ? "destructive" : "default"}>
        Enregistrer la décision
      </ActionSubmit>
    </ActionForm>
  );
}
