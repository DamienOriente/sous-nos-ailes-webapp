import type { Metadata } from "next";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { DescriptionExample } from "@/components/pages/workspace/examples";
import { IllustratedEmpty } from "@/components/pages/workspace/illustrated-empty";
import { WelcomeCard } from "@/components/pages/workspace/welcome-card";
import { CompletenessCard } from "@/components/professionals/completeness-card";
import { InquiryStatusBadge } from "@/components/inquiries/inquiry-status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { requireActor } from "@/lib/session";
import { formatDateFr } from "@/lib/utils";
import { listInquiriesForProfessional } from "@/modules/inquiries/application/inquiry-service";
import { getDraft, getPublishedPage } from "@/modules/pages/application/page-service";
import { getDashboardData } from "@/modules/professionals/application/professional-service";
import { EVENT_ROLE_LABELS } from "@/modules/authorization";
import { canTransition, describeStatus } from "@/modules/professionals/domain/status";
import { submitListingAction } from "./fiche/actions";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function ProDashboardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const actor = await requireActor(`/app/pro/${id}`);
  const data = await getDashboardData(actor, id);
  const recent = (await listInquiriesForProfessional(actor, id)).slice(0, 5);
  const { listing } = data;
  const status = describeStatus(listing.status, listing.statusReason);
  const canSubmit = canTransition(listing.status, "pending_review", "owner");
  const base = `/app/pro/${id}`;
  const preview = await loadPreview(actor, id, listing.slug, listing.status === "published");
  const firstName = actor.name.split(/\s+/)[0] ?? actor.name;
  return (
    <div className="space-y-6">
      <WelcomeCard firstName={firstName} listingName={listing.displayName || "Fiche sans nom"} status={listing.status} slug={listing.slug} baseHref={base} preview={preview} />
      {sp.limite === "1" && (
        <Alert>
          <AlertTitle>Un compte indépendant a une seule fiche</AlertTitle>
          <AlertDescription>
            Vos autres activités s'ajoutent comme métiers secondaires de cette fiche. Si vous êtes une société ou une association avec plusieurs activités, faites valider votre structure comme agence depuis{" "}
            <Link href="/app/pro/structure" className="underline underline-offset-2">
              Ma structure
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}
      {listing.billingHoldAt && (
        <Alert>
          <AlertTitle>Fiche retirée de l'annuaire</AlertTitle>
          <AlertDescription>L'abonnement agence ne couvre plus cette fiche. Elle est conservée telle quelle et revient dès le règlement de l'abonnement.</AlertDescription>
        </Alert>
      )}
      {sp.submitted === "1" && (
        <Alert>
          <AlertTitle>Fiche envoyée à la validation</AlertTitle>
          <AlertDescription>Merci ! Notre équipe relit votre fiche. En attendant, complétez vos prestations et disponibilités.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Statut : {status.explanation}</CardTitle>
            <CardDescription>Prochaine étape : {status.nextStep}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canSubmit && (
              <ConfirmDialog
                trigger={<Button data-testid="submit-listing">Soumettre à la validation</Button>}
                title="Soumettre la fiche ?"
                description="Notre équipe relira votre fiche. Vous pourrez continuer à compléter prestations et disponibilités pendant ce temps."
                confirmLabel="Soumettre"
                destructive={false}
                onConfirm={submitListingAction.bind(null, id)}
                successMessage="Fiche soumise à la validation."
              />
            )}
            <Button asChild variant="outline">
              <Link href={`${base}/fiche`}>Modifier ma fiche</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${base}/page`}>Ma page publique</Link>
            </Button>
          </CardContent>
        </Card>
        <CompletenessCard result={data.completeness} baseHref={base} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Demandes reçues" value={recent.length >= 5 ? "5+" : recent.length} hint="Dernières demandes" />
        <StatCard label="Niveau de vérification" value={`${listing.verificationLevel}/5`} hint="Voir l'onglet Vérification" />
        <StatCard label="Évènements à venir" value={data.upcoming.length} hint="Où vous intervenez" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Demandes récentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <IllustratedEmpty title="Aucune demande pour l'instant" description="Les demandes envoyées depuis votre page publique arrivent ici, avec une notification. Une page complète, avec photos et prestations chiffrées, en reçoit davantage." className="border-0 bg-transparent p-0 sm:p-0" />
            ) : (
              <ul className="divide-y">
                {recent.map((i) => (
                  <li key={i.id}>
                    <Link href={`${base}/demandes/${i.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-muted">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{i.requesterName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[i.eventTypeLabel, i.eventDate, i.eventCity].filter(Boolean).join(" · ") || formatDateFr(i.createdAt)}
                        </p>
                      </div>
                      <InquiryStatusBadge status={i.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="link" size="sm" className="mt-3 px-0">
              <Link href={`${base}/demandes`}>Toutes les demandes</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Prochains évènements</CardTitle>
            <CardDescription>Évènements où vous êtes prestataire.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcoming.length === 0 ? (
              <IllustratedEmpty title="Aucun évènement planifié" description="Quand un organisateur vous ajoute à son équipe, l'évènement apparaît ici avec son planning et ses documents." className="border-0 bg-transparent p-0 sm:p-0" />
            ) : (
              <ul className="divide-y">
                {data.upcoming.map((e) => (
                  <li key={e.id}>
                    <Link href={`/app/evenements/${e.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-muted">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.eventDate ? formatDateFr(e.eventDate) : "Date à confirmer"}
                          {e.city ? ` · ${e.city}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{EVENT_ROLE_LABELS[e.role]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      {data.completeness.score < 90 && <DescriptionExample />}
    </div>
  );
}

/** Miniature source: the published page when online, otherwise the professional's draft. Never blocks the dashboard. */
async function loadPreview(actor: Parameters<typeof getDraft>[0], id: string, slug: string, published: boolean) {
  try {
    if (published) {
      const page = await getPublishedPage(slug);
      if (page) {
        const draft = await getDraft(actor, id);
        return { data: page.data, kind: "published" as const, versionNumber: draft.published?.versionNumber ?? 1 };
      }
    }
    const draft = await getDraft(actor, id);
    return { data: draft.renderData, kind: "draft" as const, versionNumber: draft.draft.versionNumber };
  } catch {
    return null;
  }
}
