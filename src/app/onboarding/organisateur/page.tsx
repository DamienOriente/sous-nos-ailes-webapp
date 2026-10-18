import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { professionalCategories, userProfiles } from "@/db/schema";
import { OrganizerOnboardingAside } from "@/components/identity/organizer-onboarding-aside";
import { requireActor } from "@/lib/session";
import { createEventAction } from "./actions";

export const metadata: Metadata = { title: "Créer mon espace évènement" };

export default async function OrganizerOnboardingPage() {
  const actor = await requireActor("/onboarding/organisateur");
  const [profile] = await db.select({ firstName: userProfiles.firstName }).from(userProfiles).where(eq(userProfiles.userId, actor.userId)).limit(1);
  const categories = await db
    .select({ slug: professionalCategories.slug, name: professionalCategories.name, group: professionalCategories.group, isChildcare: professionalCategories.isChildcare })
    .from(professionalCategories)
    .where(eq(professionalCategories.isActive, true))
    .orderBy(asc(professionalCategories.sortOrder));
  const firstName = profile?.firstName || actor.name.split(" ")[0] || actor.name;
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold text-balance">Préparons votre évènement</h1>
        <p className="max-w-xl text-muted-foreground text-pretty">Bienvenue, {firstName}. Quatre questions pour créer votre espace : liste de tâches adaptée, budget par poste, équipe et messagerie. Le résumé à droite se remplit au fur et à mesure ; tout reste modifiable ensuite.</p>
      </div>
      <OrganizerOnboardingAside firstName={firstName} form={{ categories, firstName, mode: "onboarding", action: createEventAction }} />
    </div>
  );
}
