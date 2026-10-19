import { notFound } from "next/navigation";
import { EventHeader } from "@/components/events/event-header";
import { EventNav } from "@/components/events/event-nav";
import { buildEventNav } from "@/components/events/build-event-nav";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { getEventForMember } from "@/modules/events/application/event-service";

export default async function EventWorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}`);
  let event: Awaited<ReturnType<typeof getEventForMember>>;
  try {
    event = await getEventForMember(actor, id);
  } catch (e) {
    if (isAppError(e) && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
  return (
    <div className="space-y-6">
      <EventHeader event={event} role={event.access.role} />
      <EventNav items={buildEventNav(id, event.access)} />
      <div>{children}</div>
    </div>
  );
}
