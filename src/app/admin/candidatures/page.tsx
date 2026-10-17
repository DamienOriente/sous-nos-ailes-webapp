import type { Metadata } from "next";
import { listApplications, listContactMessages } from "@/server/services/applications";
import { markContactHandledAction, setApplicationStatusAction } from "@/server/actions/admin/applications";
import { formatInstantParis } from "@/lib/time";
import { truncate } from "@/lib/sanitize";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flash } from "@/components/admin/flash";
import { AdminSection, Disclosure } from "@/components/admin/section";
import { ApplicationStatusBadge } from "@/components/admin/badges";

export const metadata: Metadata = { title: "Candidatures et contacts" };

const KIND_LABELS = { PROVIDER: "Intervenant·e", PARTNER: "Lieu partenaire" } as const;

export default async function ApplicationsPage({ searchParams }: PageProps<"/admin/candidatures">) {
  const query = await searchParams;
  const [applications, messages] = await Promise.all([listApplications(), listContactMessages()]);
  const pendingMessages = messages.filter((m) => !m.handledAt);

  return (
    <>
      <PageHeader title="Candidatures et contacts" description="Candidatures d’intervenant·es, demandes de partenariat et messages du formulaire de contact." />
      <Flash searchParams={query} />

      <AdminSection id="candidatures" title="Candidatures" description="Les statuts sont internes ; aucune réponse automatique n’est envoyée, vous écrivez vous-même à la personne.">
        {applications.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Personne</Th>
                <Th>Contact</Th>
                <Th>Commune / structure</Th>
                <Th>Message</Th>
                <Th>Statut</Th>
                <Th>Reçue le</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <Td className="whitespace-nowrap">{KIND_LABELS[application.kind]}</Td>
                  <Td className="min-w-36 font-semibold">{application.name}</Td>
                  <Td className="min-w-44">
                    <a href={`mailto:${application.email}`} className="text-sage-800 underline">
                      {application.email}
                    </a>
                    {application.phone ? <span className="block text-[13px] text-ink-500">{application.phone}</span> : null}
                  </Td>
                  <Td className="min-w-36 text-ink-700">
                    {application.city ?? "—"}
                    {application.organisation ? <span className="block text-[13px] text-ink-500">{application.organisation}</span> : null}
                    {application.sector ? <span className="block text-[13px] text-ink-500">{application.sector}</span> : null}
                  </Td>
                  <Td className="min-w-64 text-ink-700">
                    <details>
                      <summary className="cursor-pointer">{truncate(application.message, 90)}</summary>
                      <p className="mt-2 whitespace-pre-line">{application.message}</p>
                    </details>
                  </Td>
                  <Td>
                    <ApplicationStatusBadge status={application.status} />
                    {application.reviewNote ? <span className="mt-1 block text-[13px] text-ink-500">{application.reviewNote}</span> : null}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-700">{formatInstantParis(application.createdAt)}</Td>
                  <Td className="min-w-64">
                    <Disclosure summary="Changer le statut">
                      <form action={setApplicationStatusAction.bind(null, application.id)} className="flex flex-col gap-3">
                        <Field label="Note interne" htmlFor={`app-note-${application.id}`} optionalLabel>
                          <Input id={`app-note-${application.id}`} name="note" defaultValue={application.reviewNote ?? ""} maxLength={1000} />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                          {application.status !== "REVIEWING" ? (
                            <Button type="submit" name="status" value="REVIEWING" variant="secondary" size="sm">
                              En cours d’étude
                            </Button>
                          ) : null}
                          {application.status !== "ACCEPTED" ? (
                            <Button type="submit" name="status" value="ACCEPTED" variant="sage" size="sm">
                              Retenir
                            </Button>
                          ) : null}
                          {application.status !== "DECLINED" ? (
                            <Button type="submit" name="status" value="DECLINED" variant="danger" size="sm">
                              Ne pas retenir
                            </Button>
                          ) : null}
                        </div>
                      </form>
                    </Disclosure>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Aucune candidature" description="Les candidatures envoyées depuis le site public apparaissent ici." />
        )}
      </AdminSection>

      <AdminSection id="contacts" title="Messages de contact" description={pendingMessages.length ? `${pendingMessages.length} message${pendingMessages.length > 1 ? "s" : ""} à traiter.` : "Tous les messages sont traités."}>
        {messages.length ? (
          <ul className="flex flex-col gap-2">
            {messages.map((message) => (
              <li key={message.id} className="rounded-md border border-sage-200 bg-ivory-50 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">
                      {message.subject ?? "Sans objet"}
                      <span className="ml-2 text-sm font-normal text-ink-500">
                        de {message.name} ·{" "}
                        <a href={`mailto:${message.email}`} className="underline">
                          {message.email}
                        </a>
                      </span>
                    </p>
                    <p className="text-[13px] text-ink-500">Reçu le {formatInstantParis(message.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {message.handledAt ? (
                      <StatusBadge tone="sage">Traité le {formatInstantParis(message.handledAt)}</StatusBadge>
                    ) : (
                      <>
                        <StatusBadge tone="warning">À traiter</StatusBadge>
                        <form action={markContactHandledAction.bind(null, message.id)}>
                          <Button type="submit" variant="secondary" size="sm">
                            Marquer traité
                          </Button>
                        </form>
                      </>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-ink-900">{message.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Aucun message" description="Les messages du formulaire de contact apparaissent ici." />
        )}
      </AdminSection>
    </>
  );
}
