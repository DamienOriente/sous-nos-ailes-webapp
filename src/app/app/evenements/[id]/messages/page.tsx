import { redirect } from "next/navigation";
import { requireActor } from "@/lib/session";
import { listChannels } from "@/modules/collaboration/application/channel-service";
import { guardPage } from "../_guards";

/** Entry point: opens the general channel (or the first visible one). */
export default async function MessagesIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/messages`);
  const { channels } = await guardPage(() => listChannels(actor, id));
  const general = channels.find((c) => c.kind === "general") ?? channels[0];
  if (general) redirect(`/app/evenements/${id}/messages/${general.id}`);
  return (
    <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground" role="status">
      Aucun canal n'est accessible pour le moment.
    </div>
  );
}
