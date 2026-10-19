"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAppError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { shortlistProfessional } from "@/modules/events/application/provider-service";

const schema = z.object({ eventId: z.uuid(), professionalId: z.uuid() });

/** "Ajouter à mon évènement" from the directory: picks the event, then shortlists the professional. */
export async function shortlistAction(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({ eventId: formData.get("eventId"), professionalId: formData.get("professionalId") });
  if (!parsed.success) redirect("/app/evenements?erreur=selection");
  let target: string;
  try {
    const actor = await requireActorOrThrow();
    const res = await shortlistProfessional(actor, parsed.data.eventId, parsed.data.professionalId);
    revalidatePath(`/app/evenements/${parsed.data.eventId}/prestataires`);
    target = `/app/evenements/${parsed.data.eventId}/prestataires/${res.id}?ajout=1`;
  } catch (e) {
    const msg = isAppError(e) ? e.message : "Une erreur inattendue est survenue.";
    target = `/app/evenements?invite=${parsed.data.professionalId}&erreur=${encodeURIComponent(msg)}`;
  }
  redirect(target);
}
