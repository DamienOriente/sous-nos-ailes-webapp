"use client";
import { useActionState } from "react";
import { sendReport, type ReportFormState } from "@/app/(public)/signalement/actions";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_REASON_LABELS, REPORT_REASONS, REPORT_RESOURCE_LABELS, REPORT_RESOURCE_TYPES } from "@/modules/legal/domain/reports";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {errors[0]}
    </p>
  );
}

export function ReportForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action] = useActionState<ReportFormState, FormData>(sendReport, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const v = (key: string, fallback?: string) => state?.values?.[key] ?? fallback;

  if (state?.ok) {
    return (
      <div role="status" className="rounded-2xl border bg-card p-6" data-testid="report-success">
        <h2 className="text-lg font-semibold">Signalement enregistré</h2>
        <p className="mt-2 text-muted-foreground">Merci. Un dossier de modération a été ouvert. Si vous avez laissé une adresse e-mail, vous serez informé de la suite donnée.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage error={state && !state.ok ? state.error : null} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="report-type">Que signalez-vous ?</Label>
          <select id="report-type" name="resourceType" required className={selectClass} defaultValue={v("resourceType", "professional")} aria-invalid={Boolean(errors?.resourceType)}>
            {REPORT_RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {REPORT_RESOURCE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-reason">Motif</Label>
          <select id="report-reason" name="reason" required className={selectClass} defaultValue={v("reason", "inappropriate")} aria-invalid={Boolean(errors?.reason)}>
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {REPORT_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="report-ref">Lien ou nom du contenu</Label>
        <Input id="report-ref" name="resourceRef" placeholder="https://sousnosailes.fr/pro/… ou le nom affiché" required defaultValue={v("resourceRef")} aria-invalid={Boolean(errors?.resourceRef)} aria-describedby={errors?.resourceRef ? "report-ref-error" : undefined} />
        <FieldError id="report-ref-error" errors={errors?.resourceRef} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="report-details">Que s'est-il passé ?</Label>
        <Textarea id="report-details" name="details" rows={5} required defaultValue={v("details")} aria-invalid={Boolean(errors?.details)} aria-describedby={errors?.details ? "report-details-error" : "report-details-hint"} />
        <p id="report-details-hint" className="text-xs text-muted-foreground">
          Décrivez les faits. N'incluez pas d'information de santé ni de donnée sur un enfant au-delà du strict nécessaire.
        </p>
        <FieldError id="report-details-error" errors={errors?.details} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="report-email">Votre e-mail (facultatif)</Label>
        <Input id="report-email" name="reporterEmail" type="email" autoComplete="email" defaultValue={v("reporterEmail", defaultEmail)} aria-invalid={Boolean(errors?.reporterEmail)} aria-describedby="report-email-hint" />
        <p id="report-email-hint" className="text-xs text-muted-foreground">
          Uniquement pour vous informer de la suite donnée. Jamais transmis à la personne signalée.
        </p>
        <FieldError id="report-email-error" errors={errors?.reporterEmail} />
      </div>
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="report-website">Ne pas remplir</label>
        <input id="report-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <SubmitButton size="lg" className="rounded-full px-5" pendingLabel="Envoi…">
        Envoyer le signalement
      </SubmitButton>
    </form>
  );
}
