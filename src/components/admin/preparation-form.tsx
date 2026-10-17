"use client";

import { useActionState } from "react";
import { updatePreparationAction } from "@/server/actions/admin/events";
import { idleState } from "@/server/action-state";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/admin/submit-button";
import { PreparationFields } from "@/components/admin/event-details-form";
import type { TriState } from "@/generated/prisma/enums";

export function PreparationForm({
  eventId,
  event,
}: {
  eventId: string;
  event: { dedicatedSpace: TriState; spaceDescription: string | null; meetingPoint: string | null; onSiteContactName: string | null; onSiteContactPhone: string | null; scheduleNotes: string | null };
}) {
  const [state, action] = useActionState(updatePreparationAction.bind(null, eventId), idleState);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.status === "success" ? <Alert kind="success" role="status">{state.message}</Alert> : null}
      {state.status === "error" ? <Alert kind="danger" role="alert">{state.message}</Alert> : null}
      <PreparationFields state={state} event={event} />
      <div className="flex justify-end border-t border-sage-200 pt-4">
        <SubmitButton label="Enregistrer la préparation" variant="secondary" />
      </div>
    </form>
  );
}
