import { notFound } from "next/navigation";
import { CheckCircle2, QrCode, ShieldAlert, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { CheckinConsole } from "@/components/invitations/checkin-console";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { formatDateFr } from "@/lib/utils";
import { requireEventPermission } from "@/modules/authorization";
import { CHECKIN_RESULT_LABELS } from "@/modules/invitations/domain/tokens";
import { getCheckinStats, listCheckins } from "@/modules/invitations/application/invitation-service";

export const metadata = { title: "Contrôle d'accès — Sous Nos Ailes" };
export const dynamic = "force-dynamic";

export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/checkin`);
  try {
    await requireEventPermission(actor, id, "event.invitations.checkin");
  } catch (e) {
    if (isAppError(e)) notFound();
    throw e;
  }
  const [stats, history] = await Promise.all([getCheckinStats(actor, id), listCheckins(actor, id, 50)]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Jour J" title="Contrôle d'accès" description="Validez les QR codes des invitations à l'entrée. Un code accepté une fois est ensuite signalé comme déjà utilisé. L'identité n'est jamais déduite du code : vérifiez-la si nécessaire." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Entrées validées" value={stats.accepted} icon={CheckCircle2} tone="success" />
        <StatCard label="Personnes présentes (est.)" value={stats.presentPersons} icon={Users} />
        <StatCard label="Doublons" value={stats.duplicate} icon={ShieldAlert} tone="warning" />
        <StatCard label="QR émis" value={stats.invitationsWithQr} icon={QrCode} hint={`${stats.rejected} refus`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <CheckinConsole eventId={id} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune validation pour l'instant.</p>
            ) : (
              <ul className="divide-y text-sm" data-testid="checkin-history">
                {history.map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{h.recipientName ?? "Code inconnu"}</p>
                      <p className="text-xs text-muted-foreground">
                        {CHECKIN_RESULT_LABELS[h.result].split(" — ")[0]}
                        {h.scannedByName ? ` · ${h.scannedByName}` : ""}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={h.scannedAt.toISOString()}>
                      {formatDateFr(h.scannedAt, { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
