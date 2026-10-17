"use server";
import { redirect } from "next/navigation";
import { requireActorOrThrow } from "@/lib/session";
import { setPrimaryIntent } from "@/modules/identity/application/profile-service";
import { primaryIntentSchema } from "@/modules/identity/domain/profile";

const DESTINATIONS = { organizer: "/onboarding/organisateur", professional: "/onboarding/professionnel" } as const;

/** Stores the chosen intent then hands over to the matching module's onboarding. */
export async function chooseIntentAction(formData: FormData): Promise<void> {
  const actor = await requireActorOrThrow();
  const parsed = primaryIntentSchema.safeParse(formData.get("intent"));
  if (!parsed.success) redirect("/onboarding?erreur=choix");
  await setPrimaryIntent(actor, parsed.data);
  redirect(DESTINATIONS[parsed.data]);
}
