import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { InvitationForm } from "@/components/invitations/invitation-form";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { getInvitationEntitlement, listInvitationGuestsOptions } from "@/modules/invitations/application/invitation-service";
import { createInvitationAction } from "../actions";

export const metadata = { title: "Nouvelle invitation" };

export default async function NewInvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/invitations/nouvelle`);
  try {
    await requireEventPermission(actor, id, "event.invitations.manage");
  } catch (e) {
    if (isAppError(e)) notFound();
    throw e;
  }
  const [event] = await db.select({ name: events.name, type: events.type, eventDate: events.eventDate, startsAt: events.startsAt, timezone: events.timezone, venueName: events.venueName, city: events.city }).from(events).where(eq(events.id, id)).limit(1);
  if (!event) notFound();
  const [{ guests, groups }, entitlement] = await Promise.all([listInvitationGuestsOptions(actor, id), getInvitationEntitlement(id)]);
  const onSubmit = createInvitationAction.bind(null, id);
  return (
    <div className="space-y-6">
      <Link href={`/app/evenements/${id}/invitations`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" /> Invitations</Link>
      <PageHeader title="Nouvelle invitation" description="Un lien RSVP sécurisé est créé automatiquement : envoyez-le par e-mail ou copiez-le." />
      <InvitationForm eventId={id} event={{ eventName: event.name, eventType: event.type, eventDate: event.eventDate, startsAt: event.startsAt, timezone: event.timezone, venueName: event.venueName, city: event.city }} guests={guests} groups={groups} premium={entitlement.premium} onSubmit={onSubmit} />
    </div>
  );
}
