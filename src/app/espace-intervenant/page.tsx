import type { Metadata } from "next";
import Link from "next/link";
import { requireProvider } from "@/server/authz";
import { getProviderPortal, providerEventView } from "@/server/services/providers";
import { getSettings } from "@/server/services/settings";
import { EVENT_STATUS_LABELS, INVITATION_STATUS_LABELS } from "@/domain/labels";
import { formatEventWindow, formatInstantParis } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { LabelCard } from "@/components/ui/label-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { FlashAlerts } from "@/components/portal/flash-alerts";
import { readFlash } from "@/components/portal/flash";
import { ProviderEventFacts } from "@/components/portal/provider-event-facts";
import { InvitationResponseForm } from "@/components/portal/invitation-response-form";
import { EVENT_STATUS_TONES, INVITATION_STATUS_TONES } from "@/components/portal/tones";

export const metadata: Metadata = { title: "Mes missions" };

const HOME = "/espace-intervenant";

function SectionTitle({ id, children, count }: { id: string; children: React.ReactNode; count?: number }) {
  return (
    <h2 id={id} className="font-sans text-lg font-semibold text-ink-900">
      {children}
      {typeof count === "number" ? <span className="ml-2 text-[15px] font-medium text-ink-500 tabular">({count})</span> : null}
    </h2>
  );
}

export default async function ProviderHomePage({ searchParams }: PageProps<"/espace-intervenant">) {
  const { profile } = await requireProvider(HOME);
  const [portal, settings, query] = await Promise.all([getProviderPortal(profile.id), getSettings(), searchParams]);
  const flash = readFlash(query);
  const owner = settings.ownerFirstName;

  const pending = portal.invitations.filter((invitation) => invitation.status === "PENDING");
  const awaiting = portal.invitations.filter((invitation) => invitation.status === "ACCEPTED" && !invitation.assignment);
  const refusedOrExpired = portal.invitations.filter((invitation) => invitation.status === "DECLINED" || invitation.status === "EXPIRED");
  const missions = portal.assignments.filter((assignment) => assignment.event.status !== "COMPLETED" && assignment.event.status !== "CANCELLED");
  const pastMissions = portal.assignments.filter((assignment) => assignment.event.status === "COMPLETED" || assignment.event.status === "CANCELLED");
  const nothingActive = pending.length === 0 && awaiting.length === 0 && missions.length === 0;
  const historyCount = refusedOrExpired.length + pastMissions.length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Mes missions"
        description={`Les propositions de ${owner}, vos disponibilités transmises et vos missions confirmées. Vous êtes libre d’accepter ou de refuser chaque proposition.`}
      />
      <FlashAlerts flash={flash} />

      {nothingActive ? (
        <EmptyState
          title="Aucune mission en cours"
          description={`Lorsque ${owner} vous propose une mission, elle apparaît ici avec les informations utiles pour vous décider. Pensez à tenir vos disponibilités à jour.`}
          action={
            <LinkButton href="/espace-intervenant/disponibilites" variant="secondary">
              Mettre à jour mes disponibilités
            </LinkButton>
          }
        />
      ) : null}

      {pending.length ? (
        <section aria-labelledby="pending-title" className="flex flex-col gap-4">
          <SectionTitle id="pending-title" count={pending.length}>
            Propositions en attente
          </SectionTitle>
          <ul className="flex flex-col gap-4">
            {pending.map((invitation) => {
              const view = providerEventView(invitation.event, { assigned: false });
              return (
                <li key={invitation.id}>
                  <LabelCard as="article" reference={view.reference} title={view.title}>
                    <ProviderEventFacts
                      className="mt-4"
                      view={view}
                      extra={[
                        { label: `Message de ${owner}`, value: invitation.message ? <span className="whitespace-pre-line">{invitation.message}</span> : "—" },
                        { label: "Réponse souhaitée avant le", value: formatInstantParis(invitation.expiresAt) },
                      ]}
                    />
                    <div className="mt-5 border-t border-sage-100 pt-5">
                      <InvitationResponseForm invitationId={invitation.id} returnTo={HOME} ownerFirstName={owner} />
                    </div>
                    <p className="mt-4 text-sm text-ink-500">
                      <Link href={`/espace-intervenant/missions/${view.id}`} className="font-semibold text-sage-800 underline">
                        Voir la fiche de cette mission
                      </Link>
                    </p>
                  </LabelCard>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {awaiting.length ? (
        <section aria-labelledby="awaiting-title" className="flex flex-col gap-4">
          <SectionTitle id="awaiting-title" count={awaiting.length}>
            Disponibilités transmises, en attente d’affectation
          </SectionTitle>
          <p className="max-w-2xl text-[15px] leading-snug text-ink-500">Vous avez indiqué être disponible. {owner} confirme l’affectation ; les coordonnées pratiques vous seront alors communiquées.</p>
          <ul className="flex flex-col gap-4">
            {awaiting.map((invitation) => {
              const view = providerEventView(invitation.event, { assigned: false });
              return (
                <li key={invitation.id}>
                  <LabelCard as="article" reference={view.reference} title={view.title}>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <StatusBadge tone={INVITATION_STATUS_TONES[invitation.status]}>{INVITATION_STATUS_LABELS[invitation.status]}</StatusBadge>
                      <span className="text-sm text-ink-500">Réponse transmise le {formatInstantParis(invitation.respondedAt)}</span>
                    </div>
                    <ProviderEventFacts className="mt-4" view={view} />
                    <p className="mt-4 text-sm">
                      <Link href={`/espace-intervenant/missions/${view.id}`} className="font-semibold text-sage-800 underline">
                        Voir la fiche de cette mission
                      </Link>
                    </p>
                  </LabelCard>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {missions.length ? (
        <section aria-labelledby="missions-title" className="flex flex-col gap-4">
          <SectionTitle id="missions-title" count={missions.length}>
            Missions confirmées
          </SectionTitle>
          <ul className="flex flex-col gap-4">
            {missions.map((assignment) => {
              const view = providerEventView(assignment.event, { assigned: true });
              return (
                <li key={assignment.id}>
                  <LabelCard as="article" reference={view.reference} title={view.title}>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <StatusBadge tone={EVENT_STATUS_TONES[assignment.event.status]}>{EVENT_STATUS_LABELS[assignment.event.status]}</StatusBadge>
                      {assignment.roleLabel ? <span className="text-sm text-ink-500">Rôle : {assignment.roleLabel}</span> : null}
                    </div>
                    <ProviderEventFacts className="mt-4" view={view} />
                    <div className="mt-5 flex flex-wrap gap-2 border-t border-sage-100 pt-5">
                      <LinkButton href={`/espace-intervenant/missions/${view.id}`} variant="secondary" size="sm">
                        Voir la mission
                      </LinkButton>
                      <LinkButton href={`/espace-intervenant/missions/${view.id}/brief`} variant="ghost" size="sm">
                        Brief imprimable
                      </LinkButton>
                    </div>
                  </LabelCard>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {historyCount ? (
        <details className="rounded-md border border-sage-200 bg-ivory-50">
          <summary className="cursor-pointer px-4 py-3 text-[15px] font-semibold text-ink-700">
            Historique <span className="font-medium text-ink-500 tabular">({historyCount})</span>
          </summary>
          <ul className="divide-y divide-sage-100 border-t border-sage-200">
            {pastMissions.map((assignment) => (
              <li key={assignment.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-medium text-ink-900">{assignment.event.title}</span>
                  <span className="text-sm text-ink-500">
                    {assignment.event.reference} · {formatEventWindow({ date: assignment.event.date, startsAt: assignment.event.startsAt, endsAt: assignment.event.endsAt })}
                  </span>
                </span>
                <StatusBadge tone={EVENT_STATUS_TONES[assignment.event.status]} className="self-start sm:self-center">
                  {EVENT_STATUS_LABELS[assignment.event.status]}
                </StatusBadge>
              </li>
            ))}
            {refusedOrExpired.map((invitation) => (
              <li key={invitation.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-medium text-ink-900">{invitation.event.title}</span>
                  <span className="text-sm text-ink-500">
                    {invitation.event.reference} · {formatEventWindow({ date: invitation.event.date, startsAt: invitation.event.startsAt, endsAt: invitation.event.endsAt })}
                  </span>
                </span>
                <StatusBadge tone={INVITATION_STATUS_TONES[invitation.status]} className="self-start sm:self-center">
                  {INVITATION_STATUS_LABELS[invitation.status]}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
