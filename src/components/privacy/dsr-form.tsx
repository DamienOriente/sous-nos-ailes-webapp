"use client";
import { useActionState, useState } from "react";
import { fileDataSubjectRequest, type DsrFormState } from "@/app/app/compte/confidentialite/actions";
import { FormMessage } from "@/components/shared/form-message";
import { SubmitButton } from "@/components/shared/submit-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DSR_KIND_LABELS, SELF_SERVICE_KINDS } from "@/modules/privacy/domain/dsr";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const HELP: Record<string, string> = {
  rectification: "Indiquez quelle information est inexacte et la valeur correcte. Les informations de votre profil se modifient directement depuis « Mon compte ».",
  erasure: "Votre compte et vos données seront supprimés par une personne de l'équipe sous 30 jours, sauf obligation légale de conservation (facturation, litige), auquel cas nous vous l'expliquerons.",
  restriction: "Précisez quel traitement vous souhaitez geler et pourquoi (par exemple le temps de vérifier l'exactitude d'une donnée).",
  objection: "Précisez le traitement auquel vous vous opposez. Pour les e-mails, vous pouvez aussi ajuster vos préférences de notification.",
  portability: "Vous recevrez vos données dans un format structuré ; l'export JSON ci-dessus est disponible immédiatement.",
};

export function DsrForm() {
  const [state, action] = useActionState<DsrFormState, FormData>(fileDataSubjectRequest, null);
  const [kind, setKind] = useState("rectification");
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage error={state && !state.ok ? state.error : null} success={state?.ok ? `Demande enregistrée. Réponse attendue au plus tard le ${new Date(state.data.dueAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.` : null} />
      <div className="space-y-2">
        <Label htmlFor="dsr-kind">Type de demande</Label>
        <select id="dsr-kind" name="kind" className={selectClass} value={kind} onChange={(e) => setKind(e.target.value)} required>
          {SELF_SERVICE_KINDS.filter((k) => k !== "erasure").map((k) => (
            <option key={k} value={k}>
              {DSR_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="dsr-details">Précisions (facultatif)</Label>
        <Textarea id="dsr-details" name="details" rows={4} maxLength={2000} aria-describedby="dsr-details-hint" />
        <p id="dsr-details-hint" className="text-xs text-muted-foreground">
          {HELP[kind]} Aucune information de santé n'est nécessaire ici.
        </p>
      </div>
      <SubmitButton className="rounded-full" pendingLabel="Envoi…">
        Envoyer la demande
      </SubmitButton>
    </form>
  );
}
