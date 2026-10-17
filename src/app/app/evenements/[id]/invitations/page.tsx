import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Plus, QrCode, ScanLine } from "lucide-react";
import { Paywall } from "@/components/billing/paywall";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { EnvelopeScene } from "@/components/illustrations/event-scenes";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { formatDateFr } from "@/lib/utils";
import { requireEventPermission } from "@/modules/authorization";
import { INVITATION_KIND_LABELS, INVITATION_STATUS_LABELS, INVITATION_STATUS_TONES, type InvitationKind } from "@/modules/invitations/domain/state";
import { INVITATION_TEMPLATE_META, type InvitationTemplateKey } from "@/modules/invitations/domain/templates";
import { getInvitationEntitlement, getInvitationStats, listInvitations } from "@/modules/invitations/application/invitation-service";

export const metadata = { title: "Invitations — Sous Nos Ailes" };

export default async function InvitationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/invitations`);
  try {
    await requireEventPermission(actor, id, "event.invitations.manage");
  } catch (e) {
    if (isAppError(e)) notFound();
    throw e;
  }
  const [invitations, stats, entitlement] = await Promise.all([listInvitations(actor, id), getInvitationStats(actor, id), getInvitationEntitlement(id)]);
  const limitReached = !entitlement.premium && entitlement.basicLimit !== null && stats.total - stats.revoked >= entitlement.basicLimit;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Évènement"
        title="Invitations"
        description="Créez des invitations individuelles, familiales ou de groupe, envoyez-les par e-mail ou partagez le lien RSVP, suivez les réponses."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/evenements/${id}/checkin`}>
                <ScanLine className="size-4" aria-hidden="true" /> Contrôle d'accès
              </Link>
            </Button>
            <Button asChild size="sm" disabled={limitReached}>
              <Link href={`/app/evenements/${id}/invitations/nouvelle`} aria-disabled={limitReached}>
                <Plus className="size-4" aria-hidden="true" /> Nouvelle invitation
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Invitations" value={stats.total} icon={Mail} hint={!entitlement.premium && entitlement.basicLimit !== null ? `${stats.total - stats.revoked}/${entitlement.basicLimit} (${entitlement.planName})` : undefined} />
        <StatCard label="Envoyées / consultées" value={stats.sent + stats.viewed} />
        <StatCard label="Répondues" value={stats.answered} tone="success" />
        <StatCard label="Révoquées / expirées" value={stats.revoked + stats.expired} />
      </div>

      {invitations.length === 0 ? (
        <IllustratedEmpty
          scene={EnvelopeScene}
          title="Aucune invitation envoyée"
          description="Une invitation couvre une personne, une famille ou un groupe. Envoyez-la par e-mail ou partagez le lien RSVP : les réponses mettent la liste des invités à jour toutes seules. Avec l'offre Plus, un QR code d'accès à usage unique sert au contrôle à l'entrée."
          example="Famille Dubois — modèle champêtre, 3 invités, répondue : 3 présents"
          action={<><Button asChild><Link href={`/app/evenements/${id}/invitations/nouvelle`}><Plus className="size-4" aria-hidden="true" /> Créer une invitation</Link></Button><Button asChild variant="outline"><Link href={`/app/evenements/${id}/invites`}>Compléter la liste des invités</Link></Button></>}
          testId="invitations-empty"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destinataire</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Modèle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden lg:table-cell">Envoyée</TableHead>
                <TableHead className="hidden sm:table-cell text-right">QR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link href={`/app/evenements/${id}/invitations/${inv.id}`} className="font-medium hover:underline">
                      {inv.recipientName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {inv.recipientEmail ?? "sans e-mail"} · {inv.guestCount} invité(s)
                    </p>
                  </TableCell>
                  <TableCell className="hidden text-sm sm:table-cell">{INVITATION_KIND_LABELS[inv.kind as InvitationKind] ?? inv.kind}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{INVITATION_TEMPLATE_META[inv.templateKey as InvitationTemplateKey]?.label ?? inv.templateKey}</TableCell>
                  <TableCell>
                    <StatusBadge tone={INVITATION_STATUS_TONES[inv.status]}>{INVITATION_STATUS_LABELS[inv.status]}</StatusBadge>
                    {inv.reminderCount > 0 && <span className="ml-1 text-xs text-muted-foreground">({inv.reminderCount} relance{inv.reminderCount > 1 ? "s" : ""})</span>}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{inv.sentAt ? formatDateFr(inv.sentAt) : "—"}</TableCell>
                  <TableCell className="hidden text-right sm:table-cell">{inv.hasCheckinToken ? <QrCode className="ml-auto size-4 text-primary" aria-label="QR généré" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!entitlement.premium && (
        <Paywall
          feature="invitations.premium"
          audience="organizer"
          description="Quatre modèles imprimables (champêtre, moderne, enfantin raffiné), messages longs, QR codes d'accès à usage unique et contrôle d'accès à l'entrée. Les invitations essentielles restent disponibles gratuitement."
          backHref={`/app/evenements/${id}`}
          backLabel="Retour à l'évènement"
        />
      )}
    </div>
  );
}
