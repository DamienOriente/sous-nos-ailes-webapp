import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProvider } from "@/server/authz";
import { providerEventView } from "@/server/services/providers";
import { getMissionForProvider } from "@/server/services/portal-extras";
import { getSettings } from "@/server/services/settings";
import { EVENT_STATUS_LABELS, INVITATION_STATUS_LABELS } from "@/domain/labels";
import { formatInstantParis } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { LabelCard } from "@/components/ui/label-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { FlashAlerts } from "@/components/portal/flash-alerts";
import { readFlash } from "@/components/portal/flash";
import { ProviderEventFacts, type FactItem } from "@/components/portal/provider-event-facts";
import { InvitationResponseForm } from "@/components/portal/invitation-response-form";
import { EVENT_STATUS_TONES, INVITATION_STATUS_TONES } from "@/components/portal/tones";

export const metadata: Metadata = { title: "Mission" };

export default async function ProviderMissionPage({ params, searchParams }: PageProps<"/espace-intervenant/missions/[eventId]">) {
  const { eventId } = await params;
  const path = `/espace-intervenant/missions/${eventId}`;
  const { profile } = await requireProvider(path);
  const mission = await getMissionForProvider(eventId, profile.id);
  if (!mission) notFound();
  const [settings, query] = await Promise.all([getSettings(), searchParams]);
  const flash = readFlash(query);
  const owner = settings.ownerFirstName;
  const { event, invitation, assigned } = mission;
  const view = providerEventView(event, { assigned });
  const pendingInvitation = invitation?.status === "PENDING" ? invitation : null;

  const extra: FactItem[] = pendingInvitation
    ? [
        { label: `Message de ${owner}`, value: pendingInvitation.message ? <span className="whitespace-pre-line">{pendingInvitation.message}</span> : "—" },
        { label: "Réponse souhaitée avant le", value: formatInstantParis(pendingInvitation.expiresAt) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={view.title}
        description={`Référence ${view.reference}`}
        meta={
          assigned ? (
            <>
              <StatusBadge tone="sage">Vous êtes affecté·e</StatusBadge>
              <StatusBadge tone={EVENT_STATUS_TONES[event.status]}>{EVENT_STATUS_LABELS[event.status]}</StatusBadge>
            </>
          ) : invitation ? (
            <StatusBadge tone={INVITATION_STATUS_TONES[invitation.status]}>{INVITATION_STATUS_LABELS[invitation.status]}</StatusBadge>
          ) : null
        }
        actions={
          <Link href="/espace-intervenant" className="text-[15px] font-semibold text-sage-800 hover:underline">
            ← Mes missions
          </Link>
        }
      />
      <FlashAlerts flash={flash} />

      <LabelCard as="section" title="Informations de mission">
        <ProviderEventFacts className="mt-4" view={view} extra={extra} />
        {assigned ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-sage-100 pt-5">
            <LinkButton href={`${path}/brief`} variant="secondary" size="sm">
              Ouvrir le brief imprimable
            </LinkButton>
          </div>
        ) : (
          <p className="mt-5 border-t border-sage-100 pt-4 text-sm leading-snug text-ink-500">
            L’adresse précise, le point de rendez-vous et le contact sur place sont communiqués après l’affectation par {owner}.
          </p>
        )}
      </LabelCard>

      {pendingInvitation ? (
        <LabelCard as="section" title="Votre réponse">
          <div className="mt-4">
            <InvitationResponseForm invitationId={pendingInvitation.id} returnTo={path} ownerFirstName={owner} />
          </div>
        </LabelCard>
      ) : null}

      {!assigned && invitation?.status === "ACCEPTED" ? (
        <Alert kind="info" role="status">
          Vous avez indiqué être disponible le {formatInstantParis(invitation.respondedAt)}. {owner} confirme l’affectation ; vous serez prévenu·e par email.
        </Alert>
      ) : null}
      {!assigned && (invitation?.status === "DECLINED" || invitation?.status === "EXPIRED") ? (
        <Alert kind="info" role="status">
          {invitation.status === "DECLINED" ? "Vous avez refusé cette proposition." : "Cette proposition a expiré sans réponse."} Elle est conservée dans votre historique.
        </Alert>
      ) : null}
    </div>
  );
}
