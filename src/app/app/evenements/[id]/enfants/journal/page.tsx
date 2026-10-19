import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireActor } from "@/lib/session";
import { getUserTimezone } from "@/modules/calendar/application/calendar-service";
import { formatDateTime } from "@/modules/calendar/domain/datetime";
import { listAccessLogs } from "@/modules/childcare/application/children-service";
import { guardPage } from "@/components/childcare/page-guard";

export const metadata = { title: "Journal d'accès" };

const ACTION_LABELS: Record<string, string> = { view_sensitive: "Consultation santé", edit_sensitive: "Saisie santé", withdraw_consent: "Retrait du consentement", export: "Export" };

export default async function AccessLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const actor = await requireActor(`/app/evenements/${eventId}/enfants/journal`);
  const { logs, timezone } = await guardPage(async () => {
    const [logs, timezone] = await Promise.all([listAccessLogs(actor, eventId), getUserTimezone(actor.userId)]);
    return { logs, timezone };
  });
  return (
    <div className="space-y-6">
      <Link href={`/app/evenements/${eventId}/enfants`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" /> Enfants</Link>
      <PageHeader title="Journal d'accès aux informations de santé" description="Qui a consulté ou modifié quoi, quand et pourquoi. Le contenu des informations n'apparaît jamais ici." />
      {logs.length === 0 ? (
        <EmptyState title="Aucun accès enregistré" description="Chaque consultation ou saisie d'information de santé sera listée ici." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Enfant</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Motif</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id} data-testid="access-log-row">
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(l.accessedAt, timezone)}</TableCell>
                  <TableCell>{l.userName}</TableCell>
                  <TableCell>
                    <Link href={`/app/evenements/${eventId}/enfants/${l.childId}`} className="hover:underline">
                      {l.childFirstName} {l.childLastName}
                    </Link>
                  </TableCell>
                  <TableCell>{ACTION_LABELS[l.action] ?? l.action}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.purpose ?? "Non renseigné"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
