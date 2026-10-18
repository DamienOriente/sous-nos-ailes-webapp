"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ActionForm, FieldErrorText, type FormAction } from "@/components/professionals/action-form";
import { FileUpload, type UploadedFileInfo } from "@/components/files/file-upload";
import { QuoteFormFields } from "./quote-form-fields";
import type { ActionResult } from "@/lib/errors";
import { INQUIRY_ACTIONS, INQUIRY_STATUS_LABELS, nextInquiryStatuses, type InquiryStatus } from "@/modules/inquiries/domain/inquiry-status";

type Props = {
  professionalId: string;
  inquiryId: string;
  status: InquiryStatus;
  replyAction: FormAction;
  quoteAction: FormAction;
  transitionAction: (professionalId: string, inquiryId: string, toStatus: string) => Promise<ActionResult<undefined>>;
  /** Guests from the brief, to show the price per guest while typing. */
  guests?: number | null;
};

export function InquiryActions({ professionalId, inquiryId, status, replyAction, quoteAction, transitionAction, guests = null }: Props) {
  const [tab, setTab] = useState<"reply" | "quote">("reply");
  const [quoteFile, setQuoteFile] = useState<UploadedFileInfo | null>(null);
  const [pending, start] = useTransition();
  const allowed = nextInquiryStatuses(status);
  const quick = INQUIRY_ACTIONS.filter((a) => allowed.includes(a.to) && a.to !== "quoted" && a.to !== "info_requested");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" aria-label="Actions rapides">
        {quick.map((a) =>
          a.to === "declined" || a.to === "archived" ? (
            <ConfirmDialog
              key={a.to}
              trigger={
                <Button variant={a.variant} size="sm" type="button">
                  {a.label}
                </Button>
              }
              title={`${a.label} ?`}
              description={a.to === "declined" ? "Le demandeur sera informé que vous ne pouvez pas donner suite." : "La demande est conservée dans l'historique."}
              confirmLabel={a.label}
              destructive={a.to === "declined"}
              onConfirm={() => transitionAction(professionalId, inquiryId, a.to)}
              successMessage={`Demande : ${INQUIRY_STATUS_LABELS[a.to]}.`}
            />
          ) : (
            <Button
              key={a.to}
              variant={a.variant}
              size="sm"
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await transitionAction(professionalId, inquiryId, a.to);
                  if (r.ok) toast.success(`Demande : ${INQUIRY_STATUS_LABELS[a.to]}.`);
                  else toast.error(r.error);
                })
              }
            >
              {a.label}
            </Button>
          ),
        )}
      </div>

      <div role="tablist" aria-label="Répondre" className="flex gap-1 border-b">
        <button role="tab" type="button" aria-selected={tab === "reply"} onClick={() => setTab("reply")} className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "reply" ? "border-primary" : "border-transparent text-muted-foreground"}`}>
          Répondre par message
        </button>
        {(allowed.includes("quoted") || status === "quoted") && (
          <button role="tab" type="button" aria-selected={tab === "quote"} onClick={() => setTab("quote")} className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === "quote" ? "border-primary" : "border-transparent text-muted-foreground"}`}>
            Envoyer un devis
          </button>
        )}
      </div>

      {tab === "reply" ? (
        <ActionForm action={replyAction} submitLabel="Envoyer la réponse" pendingLabel="Envoi…" successMessage="Réponse envoyée par e-mail au demandeur." key={`reply-${status}`}>
          <input type="hidden" name="professionalId" value={professionalId} />
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reply-message">Message</Label>
              <Textarea id="reply-message" name="message" rows={6} required minLength={2} placeholder="Bonjour, merci pour votre demande…" />
              <p className="text-xs text-muted-foreground">Envoyé par e-mail au demandeur. Ne joignez pas d'information de santé ni de document : utilisez le devis ou les documents sécurisés de l'évènement.</p>
              <FieldErrorText name="message" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply-status">Mettre à jour le statut</Label>
              <select id="reply-status" name="toStatus" defaultValue={allowed.includes("info_requested") ? "info_requested" : ""} className="h-9 w-full max-w-xs rounded-lg border bg-background px-3 text-sm">
                <option value="">Ne pas changer</option>
                {allowed
                  .filter((s) => s !== "archived")
                  .map((s) => (
                    <option key={s} value={s}>
                      {INQUIRY_STATUS_LABELS[s]}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </ActionForm>
      ) : (
        <ActionForm action={quoteAction} submitLabel="Envoyer le devis" pendingLabel="Envoi…" successMessage="Devis envoyé au demandeur.">
          <input type="hidden" name="professionalId" value={professionalId} />
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <input type="hidden" name="quoteFileId" value={quoteFile?.id ?? ""} />
          <div className="space-y-6">
            <QuoteFormFields guests={guests} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Devis PDF (facultatif)</Label>
                <FileUpload scope="professional" scopeId={professionalId} purpose="quote" accept="application/pdf" onUploaded={setQuoteFile} label={quoteFile ? `Remplacer ${quoteFile.originalName}` : "Joindre le devis"} />
                {quoteFile && <p className="text-xs text-muted-foreground">{quoteFile.originalName} : analysé avant mise à disposition.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-message">Message d'accompagnement</Label>
                <Textarea id="quote-message" name="message" rows={3} maxLength={3000} />
              </div>
            </div>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
