import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { professionalCategories, userProfiles } from "@/db/schema";
import { EventForm } from "@/components/events/event-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireActor } from "@/lib/session";
import { createEventAction } from "@/app/onboarding/organisateur/actions";

export const metadata: Metadata = { title: "Nouvel évènement — Sous Nos Ailes" };

export default async function NewEventPage() {
  const actor = await requireActor("/app/evenements/nouveau");
  const [profile] = await db.select({ firstName: userProfiles.firstName }).from(userProfiles).where(eq(userProfiles.userId, actor.userId)).limit(1);
  const categories = await db
    .select({ slug: professionalCategories.slug, name: professionalCategories.name, group: professionalCategories.group, isChildcare: professionalCategories.isChildcare })
    .from(professionalCategories)
    .where(eq(professionalCategories.isActive, true))
    .orderBy(asc(professionalCategories.sortOrder));
  const firstName = profile?.firstName || actor.name.split(" ")[0] || actor.name;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow="Mes évènements" title="Nouvel évènement" description="Un espace complet est créé en une fois : tâches, budget, équipe et messagerie." />
      <EventForm categories={categories} firstName={firstName} mode="create" action={createEventAction} />
    </div>
  );
}
