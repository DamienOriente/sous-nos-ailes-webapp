import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/authz";
import { listEventsForClient } from "@/server/services/events";
import { getSettings } from "@/server/services/settings";
import { CLIENT_STAGE_LABELS } from "@/domain/workflow";
import { formatEventWindow } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { FlashAlerts } from "@/components/portal/flash-alerts";
import { readFlash } from "@/components/portal/flash";
import { CLIENT_STAGE_TONES } from "@/components/portal/tones";

export const metadata: Metadata = { title: "Mes événements" };

export default async function ClientEventsPage({ searchParams }: PageProps<"/espace-client">) {
  const user = await requireUser({ next: "/espace-client" });
  const [events, settings, query] = await Promise.all([listEventsForClient(user.id), getSettings(), searchParams]);
  const flash = readFlash(query);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Mes événements" description={`Chaque demande transmise à ${settings.ownerFirstName} ouvre un dossier suivi ici, de la proposition à la confirmation.`} />
      <FlashAlerts flash={flash} />
      {events.length === 0 ? (
        <EmptyState
          title="Aucun dossier pour le moment"
          description={`Une demande envoyée depuis le site crée un dossier dans cet espace. ${settings.ownerFirstName} vous y transmet sa proposition, puis vous suivez la constitution de l’équipe jusqu’à la confirmation.`}
          action={
            <LinkButton href="/demander-un-devis" variant="secondary">
              Parler de mon événement
            </LinkButton>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/espace-client/evenements/${event.id}`}
                className="label-card flex flex-col gap-3 p-4 transition-colors hover:border-sage-400 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-clay-700 tabular">{event.reference}</span>
                  <span className="text-[15px] font-semibold text-ink-900">{event.title}</span>
                  <span className="text-sm leading-snug text-ink-500">
                    {formatEventWindow({ date: event.date, startsAt: event.startsAt, endsAt: event.endsAt, startTime: event.startTime, endTime: event.endTime, dateIsFlexible: event.dateIsFlexible })}
                  </span>
                </span>
                <StatusBadge tone={CLIENT_STAGE_TONES[event.stage]} className="self-start sm:self-center">
                  {CLIENT_STAGE_LABELS[event.stage]}
                </StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
