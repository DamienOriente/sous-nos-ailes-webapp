"use client";
import { useActionState } from "react";
import { changeDsrStatus, type DsrStatusFormState } from "@/app/admin/rgpd/[id]/actions";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DSR_STATUS_LABELS, type DsrStatus } from "@/modules/privacy/domain/dsr";

const NEXT: Record<DsrStatus, DsrStatus[]> = {
  received: ["in_progress", "completed", "rejected"],
  in_progress: ["completed", "rejected", "received"],
  completed: [],
  rejected: ["received"],
};

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function DsrStatusForm({ id, current }: { id: string; current: DsrStatus }) {
  const [state, action] = useActionState<DsrStatusFormState, FormData>(changeDsrStatus, null);
  const options = NEXT[current];
  if (options.length === 0) return <p className="text-sm text-muted-foreground">Cette demande est close.</p>;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <FormMessage error={state && !state.ok ? state.error : null} success={state?.ok ? "Statut mis à jour. La personne est notifiée si la demande est close." : null} />
      <div className="space-y-2">
        <Label htmlFor="dsr-status">Nouveau statut</Label>
        <select id="dsr-status" name="status" className={selectClass} defaultValue={options[0]} required>
          {options.map((s) => (
            <option key={s} value={s}>
              {DSR_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="dsr-reason">Motif / résumé du traitement</Label>
        <Textarea id="dsr-reason" name="reason" rows={4} maxLength={2000} aria-describedby="dsr-reason-hint" />
        <p id="dsr-reason-hint" className="text-xs text-muted-foreground">
          Obligatoire pour clore (traitée ou refusée). Transmis à la personne dans la notification : restez factuel, sans donnée de tiers.
        </p>
      </div>
      <SubmitButton className="rounded-full" pendingLabel="Enregistrement…">
        Enregistrer
      </SubmitButton>
    </form>
  );
}
