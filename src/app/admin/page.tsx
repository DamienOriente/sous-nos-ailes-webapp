import { auditActionLabel } from "@/domain/labels";
import type { Metadata } from "next";
import Link from "next/link";
import { getAdminDashboard } from "@/server/services/dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { LabelCard } from "@/components/ui/label-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataList } from "@/components/ui/data-list";
import { AdminSection } from "@/components/admin/section";
import { EventStatusBadge, TeamStatusBadge } from "@/components/admin/badges";
import { formatEventWindow, formatInstantParis } from "@/lib/time";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function AdminDashboardPage() {
  const dashboard = await getAdminDashboard();
  const summary = [
    { label: "Nouvelles demandes", value: dashboard.newRequests, href: "/admin/evenements?status=NEW" },
    { label: "En attente du client", value: dashboard.awaitingClient, href: "/admin/evenements?status=PROPOSAL_SENT" },
    { label: "En préparation", value: dashboard.inPreparation, href: "/admin/evenements?status=PREPARING" },
    { label: "Confirmées", value: dashboard.confirmed, href: "/admin/evenements?status=CONFIRMED" },
  ];
  const followUps = [
    { label: "Propositions de mission en attente de réponse", value: dashboard.pendingInvitations, href: "/admin/evenements?team=1" },
    { label: "Nouvelles candidatures", value: dashboard.newApplications, href: "/admin/candidatures" },
    { label: "Pages de lieux à valider", value: dashboard.venuesToReview, href: "/admin/lieux" },
    { label: "Messages de contact non traités", value: dashboard.unhandledContacts, href: "/admin/candidatures#contacts" },
  ];

  return (
    <>
      <PageHeader title="Tableau de bord" description="Ce qui attend votre attention, puis les trente prochains jours." />

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-sage-200 bg-sage-200 sm:grid-cols-4">
        {summary.map((item) => (
          <div key={item.label} className="bg-ivory-50 px-4 py-3">
            <dt className="text-[13px] font-semibold text-ink-500">{item.label}</dt>
            <dd className="mt-0.5 text-xl font-semibold text-ink-900 tabular">
              <Link href={item.href} className="hover:underline">
                {item.value}
              </Link>
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-8">
          <AdminSection id="upcoming" title="Prochains événements (30 jours)" description="Dossiers avec accord de principe, en préparation ou confirmés.">
            {dashboard.upcoming.length ? (
              <ul className="divide-y divide-sage-100 rounded-md border border-sage-200 bg-ivory-50">
                {dashboard.upcoming.map((event) => (
                  <li key={event.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link href={`/admin/evenements/${event.id}`} className="font-semibold text-sage-800 hover:underline">
                        {event.title}
                      </Link>
                      <p className="text-sm text-ink-500">
                        <span className="tabular">{event.reference}</span> · {formatEventWindow({ date: event.date, startsAt: event.startsAt, endsAt: event.endsAt })}
                        {event.venue ? ` · ${event.venue.name}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <EventStatusBadge status={event.status} />
                      <TeamStatusBadge status={event.teamStatus} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Aucun événement dans les trente prochains jours" description="Les dossiers apparaissent ici dès l’accord de principe du client." />
            )}
          </AdminSection>

          <AdminSection id="incomplete-teams" title="Équipes incomplètes" description="Événements à venir dont l’équipe n’est pas encore au complet.">
            {dashboard.incompleteTeams.length ? (
              <ul className="flex flex-col gap-2">
                {dashboard.incompleteTeams.map((event) => (
                  <li key={event.id} className="flex flex-col gap-1 rounded-md border border-sage-200 bg-ivory-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link href={`/admin/evenements/${event.id}#equipe`} className="font-semibold text-sage-800 hover:underline">
                        {event.title}
                      </Link>
                      <p className="text-sm text-ink-500">
                        {event.assignments.length}/{event.requiredProviders} affectée{event.assignments.length > 1 ? "s" : ""} · {event.invitations.filter((i) => i.status === "PENDING").length} proposition{event.invitations.filter((i) => i.status === "PENDING").length > 1 ? "s" : ""} en attente
                      </p>
                    </div>
                    <TeamStatusBadge status={event.teamStatus} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-ink-500">Toutes les équipes des événements à venir sont complètes.</p>
            )}
          </AdminSection>
        </div>

        <div className="flex flex-col gap-8">
          <LabelCard title="À suivre">
            <DataList
              className="mt-3"
              items={followUps.map((item) => ({
                label: item.label,
                value: (
                  <Link href={item.href} className="font-semibold text-sage-800 tabular hover:underline">
                    {item.value}
                  </Link>
                ),
              }))}
            />
          </LabelCard>

          <AdminSection id="audit" title="Dernières actions" description="Journal d’audit, toutes entités confondues.">
            {dashboard.recentAudit.length ? (
              <ol className="divide-y divide-sage-100 rounded-md border border-sage-200 bg-ivory-50 text-sm">
                {dashboard.recentAudit.map((entry) => (
                  <li key={entry.id} className="px-4 py-2.5">
                    <p className="text-ink-900">
                      <span className="font-medium">{auditActionLabel(entry.action)}</span>
                      {entry.summary ? <span className="ml-2 text-ink-500">{entry.summary}</span> : null}
                    </p>
                    <p className="text-[13px] text-ink-500">
                      {formatInstantParis(entry.createdAt)} · {entry.actor?.name ?? "Système"}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[15px] text-ink-500">Aucune action enregistrée pour le moment.</p>
            )}
          </AdminSection>
        </div>
      </div>
    </>
  );
}
