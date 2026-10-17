import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/authz";
import { getEventForClient } from "@/server/services/events";
import { getClientRequestMessage } from "@/server/services/portal-extras";
import { getSettings, listAllOptions } from "@/server/services/settings";
import { acceptProposal } from "@/server/actions/portal/client";
import { EVENT_TYPE_LABELS, QUOTE_STATUS_LABELS, TRI_STATE_LABELS, formatHeadcount } from "@/domain/labels";
import { CLIENT_STAGE_LABELS, TEAM_STATUS_LABELS } from "@/domain/workflow";
import { formatDateOnlyLong, formatEventWindow, formatInstantParis } from "@/lib/time";
import { formatEuros } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { LabelCard } from "@/components/ui/label-card";
import { DataList } from "@/components/ui/data-list";
import { Alert } from "@/components/ui/alert";
import { FlashAlerts } from "@/components/portal/flash-alerts";
import { readFlash } from "@/components/portal/flash";
import { StageTracker } from "@/components/portal/stage-tracker";
import { ClientPreparationForm } from "@/components/portal/client-preparation-form";
import { SubmitButton } from "@/components/portal/submit-button";
import { CLIENT_STAGE_TONES, QUOTE_STATUS_TONES } from "@/components/portal/tones";

export const metadata: Metadata = { title: "Mon dossier" };

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-sans text-lg font-semibold text-ink-900">
      {children}
    </h2>
  );
}

export default async function ClientEventPage({ params, searchParams }: PageProps<"/espace-client/evenements/[id]">) {
  const { id } = await params;
  const user = await requireUser({ next: `/espace-client/evenements/${id}` });
  const event = await getEventForClient(id, user.id);
  if (!event) notFound();
  const [settings, options, requestMessage, query] = await Promise.all([getSettings(), listAllOptions(), getClientRequestMessage(id, user.id), searchParams]);
  const flash = readFlash(query);
  const owner = settings.ownerFirstName;

  const closed = event.stage === "CLOSED" || event.stage === "COMPLETED";
  const confirmed = event.stage === "CONFIRMED" || event.stage === "COMPLETED";
  const optionLabels = options.filter((option) => event.optionCodes.includes(option.code)).map((option) => option.label);
  const dateWindow = formatEventWindow({ date: event.date, startsAt: event.startsAt, endsAt: event.endsAt, startTime: event.startTime, endTime: event.endTime, dateIsFlexible: event.dateIsFlexible });
  const venueLabel = event.venue?.name ?? event.venueName ?? "Lieu à préciser";

  const currentVersion = event.currentQuote;
  const otherVersions = (event.quote?.versions ?? []).filter((version) => version.id !== currentVersion?.id);
  const totalLabel = (vatMode: "NONE" | "STANDARD") => (vatMode === "STANDARD" ? "Total TTC" : "Total");

  const assigned = event.teamAssigned;
  const required = event.requiredProviders;
  const teamCount = `${assigned} ${assigned > 1 ? "personnes" : "personne"} sur ${required} ${required > 1 ? "prévues" : "prévue"}`;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={event.title}
        description={`Référence ${event.reference}`}
        meta={<StatusBadge tone={CLIENT_STAGE_TONES[event.stage]}>{CLIENT_STAGE_LABELS[event.stage]}</StatusBadge>}
        actions={
          <Link href="/espace-client" className="text-[15px] font-semibold text-sage-800 hover:underline">
            ← Tous mes événements
          </Link>
        }
      />
      <FlashAlerts flash={flash} />

      <section aria-labelledby="stage-title" className="flex flex-col gap-4">
        <SectionTitle id="stage-title">Avancement</SectionTitle>
        <StageTracker stage={event.stage} ownerFirstName={owner} />
      </section>

      <section aria-labelledby="request-title" className="flex flex-col gap-4">
        <SectionTitle id="request-title">Votre demande</SectionTitle>
        <LabelCard>
          <DataList
            columns={2}
            items={[
              { label: "Type d’événement", value: EVENT_TYPE_LABELS[event.eventType] },
              { label: "Date et horaires", value: event.dateNote ? `${dateWindow} — ${event.dateNote}` : dateWindow },
              { label: "Lieu", value: venueLabel },
              { label: "Commune", value: `${event.postalCode} ${event.city}` },
              { label: "Effectifs par âge", value: formatHeadcount(event) },
              { label: "Parents sur place", value: TRI_STATE_LABELS[event.parentsOnSite] },
              { label: "Espace prévu pour les enfants", value: TRI_STATE_LABELS[event.dedicatedSpace] },
              { label: "Options souhaitées", value: optionLabels.length ? optionLabels.join(", ") : "Aucune" },
              { label: "Votre message", value: requestMessage ? <span className="whitespace-pre-line">{requestMessage}</span> : "—" },
            ]}
          />
        </LabelCard>
      </section>

      <section aria-labelledby="preparation-title" className="flex flex-col gap-4">
        <SectionTitle id="preparation-title">Préparer la prestation</SectionTitle>
        <p className="max-w-2xl text-[15px] leading-snug text-ink-500">
          Ces précisions aident {owner} à organiser l’équipe sur place. Vous pouvez les compléter au fil de vos préparatifs.
        </p>
        <LabelCard>
          <ClientPreparationForm
            eventId={event.id}
            closed={closed}
            ownerFirstName={owner}
            values={{
              dedicatedSpace: event.dedicatedSpace,
              spaceDescription: event.spaceDescription,
              meetingPoint: event.meetingPoint,
              onSiteContactName: event.onSiteContactName,
              onSiteContactPhone: event.onSiteContactPhone,
              scheduleNotes: event.scheduleNotes,
            }}
          />
        </LabelCard>
      </section>

      <section aria-labelledby="proposal-title" className="flex flex-col gap-4">
        <SectionTitle id="proposal-title">Proposition</SectionTitle>
        {currentVersion ? (
          <LabelCard title={`Version ${currentVersion.number} — ${currentVersion.title}`}>
            <DataList
              className="mt-4"
              columns={2}
              items={[
                { label: totalLabel(currentVersion.vatMode), value: <span className="font-semibold tabular">{formatEuros(currentVersion.totalInclVatCents)}</span> },
                { label: "Statut", value: <StatusBadge tone={QUOTE_STATUS_TONES[currentVersion.status]}>{QUOTE_STATUS_LABELS[currentVersion.status]}</StatusBadge> },
                { label: "Transmise le", value: formatInstantParis(currentVersion.sentAt) },
                ...(currentVersion.validUntil ? [{ label: "Valable jusqu’au", value: formatDateOnlyLong(currentVersion.validUntil) }] : []),
              ]}
            />
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Link href={`/espace-client/evenements/${event.id}/propositions/${currentVersion.id}`} className="text-[15px] font-semibold text-sage-800 underline">
                Consulter le détail (version imprimable)
              </Link>
            </div>
            {currentVersion.status === "SENT" ? (
              <form action={acceptProposal.bind(null, event.id, currentVersion.id)} className="mt-6 flex flex-col gap-3 border-t border-sage-100 pt-5">
                <div>
                  <SubmitButton pendingLabel="Enregistrement…">Cette proposition me convient</SubmitButton>
                </div>
                <p className="text-sm leading-snug text-ink-500">Votre accord de principe permet de constituer l’équipe ; il ne s’agit pas d’une signature électronique certifiée.</p>
              </form>
            ) : null}
            {currentVersion.status === "ACCEPTED" && currentVersion.acceptedAt ? (
              <p className="mt-5 border-t border-sage-100 pt-4 text-[15px] leading-snug text-sage-800">
                Accord de principe donné le {formatInstantParis(currentVersion.acceptedAt)}. Il ne s’agit pas d’une signature électronique certifiée.
              </p>
            ) : null}
          </LabelCard>
        ) : (
          <LabelCard title="Proposition en préparation">
            <p className="mt-2 text-[15px] leading-snug text-ink-500">
              {closed ? "Aucune proposition n’a été transmise pour ce dossier." : `${owner} étudie votre demande et vous transmettra une proposition détaillée. Vous serez prévenu·e par email dès qu’elle sera disponible ici.`}
            </p>
          </LabelCard>
        )}
        {otherVersions.length ? (
          <div className="flex flex-col gap-2">
            <h3 className="font-sans text-[15px] font-semibold text-ink-700">Versions précédentes</h3>
            <ul className="divide-y divide-sage-100 rounded-md border border-sage-200 bg-ivory-50">
              {otherVersions.map((version) => (
                <li key={version.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex flex-col gap-0.5">
                    <Link href={`/espace-client/evenements/${event.id}/propositions/${version.id}`} className="text-[15px] font-semibold text-sage-800 underline">
                      Version {version.number} — {version.title}
                    </Link>
                    <span className="text-sm text-ink-500">
                      {formatInstantParis(version.sentAt)} · <span className="tabular">{formatEuros(version.totalInclVatCents)}</span>
                    </span>
                  </span>
                  <StatusBadge tone={QUOTE_STATUS_TONES[version.status]} className="self-start sm:self-center">
                    {QUOTE_STATUS_LABELS[version.status]}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="team-title" className="flex flex-col gap-4">
        <SectionTitle id="team-title">Préparation et équipe</SectionTitle>
        <LabelCard>
          <DataList
            columns={2}
            items={[
              { label: "Équipe", value: TEAM_STATUS_LABELS[event.teamStatus] },
              { label: "Personnes affectées", value: teamCount },
            ]}
          />
          <p className="mt-4 text-sm leading-snug text-ink-500">
            {confirmed
              ? `L’équipe est constituée et validée par ${owner}.`
              : `${owner} sollicite les intervenant·es de son réseau et confirme chaque affectation. Les coordonnées de l’équipe ne sont pas communiquées ici.`}
          </p>
        </LabelCard>
        {confirmed ? (
          <LabelCard reference={event.reference} title="Récapitulatif confirmé" className="border-sage-400">
            <DataList
              className="mt-4"
              columns={2}
              items={[
                { label: "Date et horaires", value: dateWindow },
                { label: "Lieu", value: `${venueLabel} — ${event.postalCode} ${event.city}` },
                { label: "Point de rendez-vous", value: event.meetingPoint ?? "À préciser" },
                { label: "Contact sur place", value: event.onSiteContactName ? `${event.onSiteContactName}${event.onSiteContactPhone ? ` · ${event.onSiteContactPhone}` : ""}` : "À préciser" },
                { label: "Intervenant·es", value: `${assigned} ${assigned > 1 ? "personnes" : "personne"}` },
                ...(event.confirmedAt ? [{ label: "Confirmée le", value: formatInstantParis(event.confirmedAt) }] : []),
              ]}
            />
          </LabelCard>
        ) : (
          <Alert kind="info" role="status">
            Le récapitulatif définitif apparaîtra ici une fois la prestation confirmée par {owner}.
          </Alert>
        )}
      </section>
    </div>
  );
}
