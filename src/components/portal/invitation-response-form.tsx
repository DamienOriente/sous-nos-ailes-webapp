import { respondToInvitationAction } from "@/server/actions/portal/provider";
import { Field, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/portal/submit-button";

/** Accept / decline a pending mission proposal; the action redirects with a flash. */
export function InvitationResponseForm({ invitationId, returnTo, ownerFirstName }: { invitationId: string; returnTo: string; ownerFirstName: string }) {
  const noteId = `note-${invitationId}`;
  return (
    <form action={respondToInvitationAction} className="flex flex-col gap-3">
      <input type="hidden" name="invitationId" value={invitationId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Field label={`Message pour ${ownerFirstName}`} htmlFor={noteId} optionalLabel help="Une contrainte d’horaire, une question, une précision.">
        <Textarea id={noteId} name="note" rows={2} maxLength={500} className="min-h-20" aria-describedby={`${noteId}-help`} />
      </Field>
      <p className="text-sm leading-snug text-ink-500">Accepter indique votre disponibilité ; l’affectation finale est confirmée par {ownerFirstName}.</p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="response" value="ACCEPTED" variant="sage" pendingLabel="Envoi…">
          Accepter
        </SubmitButton>
        <SubmitButton name="response" value="DECLINED" variant="secondary" pendingLabel="Envoi…">
          Refuser
        </SubmitButton>
      </div>
    </form>
  );
}
