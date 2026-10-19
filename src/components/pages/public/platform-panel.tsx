import { Container } from "@/components/shared/section";
import { formatDateFr } from "@/lib/utils";
import type { PublicActivity } from "@/modules/professionals/application/stats-service";
import { VERIFICATION_KIND_LABELS, type VerificationKind } from "@/modules/professionals/domain/verification";

/**
 * "Ce professionnel sur Sous Nos Ailes": what the platform itself can vouch
 * for, below the professional's own page. Every number comes from platform
 * records (verifications, inquiries, events, published reviews) and says how
 * it was computed; nothing here is declared by the professional.
 */
function responseLabel(hours: number): string {
  if (hours < 1) return "moins d'une heure";
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = Math.round(hours / 24);
  return days <= 1 ? "environ un jour" : `environ ${days} jours`;
}

export function PlatformPanel({ activity, displayName, isDemo }: { activity: PublicActivity; displayName: string; isDemo: boolean }) {
  const { verifications, medianResponseHours, responseRate, inquiriesAnswered, eventsCount, upcomingEventsCount, publishedReviews, averageRating, memberSince } = activity;
  const facts = [
    {
      title: "Vérifications",
      value: verifications.length > 0 ? `${verifications.length} contrôle${verifications.length > 1 ? "s" : ""} sur pièces` : "Aucun contrôle pour l'instant",
      detail:
        verifications.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {verifications.map((v) => (
              <li key={v.kind}>{VERIFICATION_KIND_LABELS[v.kind as VerificationKind]?.label ?? v.kind}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Le professionnel n'a pas encore transmis de justificatifs à notre équipe.</p>
        ),
    },
    {
      title: "Réactivité",
      value: medianResponseHours === null ? "Pas encore mesurée" : `Répond en ${responseLabel(medianResponseHours)}`,
      detail: (
        <p className="mt-2 text-xs text-muted-foreground">
          {medianResponseHours === null
            ? "Calculée dès les premières demandes reçues via la plateforme."
            : `Délai médian avant la première action sur une demande ; ${responseRate ?? 0} % des demandes ont reçu une réponse (${inquiriesAnswered} traitée${inquiriesAnswered > 1 ? "s" : ""}).`}
        </p>
      ),
    },
    {
      title: "Évènements",
      value: eventsCount === 0 ? "Aucun évènement coordonné ici" : `${eventsCount} évènement${eventsCount > 1 ? "s" : ""} coordonné${eventsCount > 1 ? "s" : ""}`,
      detail: (
        <p className="mt-2 text-xs text-muted-foreground">
          {eventsCount === 0 ? "Compte les évènements où un organisateur a ajouté ce professionnel à son équipe." : `Dont ${upcomingEventsCount} à venir. Évènements où un organisateur a ajouté ce professionnel à son équipe sur la plateforme.`}
        </p>
      ),
    },
    {
      title: "Avis",
      value: publishedReviews === 0 ? "Aucun avis publié" : `${averageRating?.toFixed(1).replace(".", ",") ?? "n/d"} sur 5, ${publishedReviews} avis`,
      detail: <p className="mt-2 text-xs text-muted-foreground">{publishedReviews === 0 ? "Seuls les organisateurs ayant échangé avec le professionnel via la plateforme peuvent en laisser un." : "Avis laissés par des organisateurs après une demande confirmée, relus avant publication."}</p>,
    },
  ];
  return (
    <section aria-labelledby="platform-panel-h" className="border-t bg-background" data-testid="platform-panel">
      <Container size="wide" className="py-12 sm:py-16">
        <div className="max-w-2xl">
          <h2 id="platform-panel-h" className="font-heading text-2xl font-semibold sm:text-3xl">
            {displayName} sur Sous Nos Ailes
          </h2>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            Ce que la plateforme constate elle-même{memberSince ? `, depuis la publication de la fiche le ${formatDateFr(memberSince)}` : ""}. Ces chiffres ne sont ni déclarés par le professionnel ni estimés.
            {isDemo ? " Fiche de démonstration : les données sont fictives." : ""}
          </p>
        </div>
        <dl className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border">
          {facts.map((f) => (
            <div key={f.title} className="lg:px-6 lg:first:pl-0 lg:last:pr-0">
              <dt className="text-sm text-muted-foreground">{f.title}</dt>
              <dd className="mt-1">
                <p className="font-heading text-lg font-semibold">{f.value}</p>
                {f.detail}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
