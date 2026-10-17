import { redirect } from "next/navigation";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { ChatScene } from "@/components/illustrations/event-scenes";
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
  return <IllustratedEmpty scene={ChatScene} title="Aucun canal accessible pour le moment" description="Les organisateurs vous ajouteront aux canaux de coordination qui concernent votre prestation. Le canal Général s'ouvre dès que votre accès est actif." example="Espace enfants — coordination de la garde : effectifs, activités, consignes" />;
}
