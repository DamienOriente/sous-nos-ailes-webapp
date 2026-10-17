import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { professionalCategories, userProfiles } from "@/db/schema";
import { EventForm } from "@/components/events/event-form";
import { Logo } from "@/components/shared/logo";
import { requireActor } from "@/lib/session";
import { createEventAction } from "./actions";

export const metadata: Metadata = { title: "Créer mon espace évènement — Sous Nos Ailes" };

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
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 space-y-3">
        <Logo />
        <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">Bienvenue {firstName}</p>
        <h1 className="font-heading text-3xl font-semibold text-balance">Préparons votre évènement</h1>
        <p className="max-w-xl text-muted-foreground text-pretty">Quelques questions pour créer votre espace : liste de tâches adaptée, budget par poste, équipe et messagerie. Tout reste modifiable ensuite.</p>
      </div>
      <EventForm categories={categories} firstName={firstName} mode="onboarding" action={createEventAction} />
    </main>
  );
}
