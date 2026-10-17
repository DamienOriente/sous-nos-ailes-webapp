import type { Metadata } from "next";
import Link from "next/link";
import { requirePartner } from "@/server/authz";
import { getPartnerPortal } from "@/server/services/venues";
import { getSettings } from "@/server/services/settings";
import type { EditorialStatus } from "@/generated/prisma/enums";
import { EDITORIAL_STATUS_LABELS, PARTNERSHIP_STATUS_LABELS, VENUE_TYPE_LABELS } from "@/domain/labels";
import { formatInstantParis } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { LabelCard } from "@/components/ui/label-card";
import { DataList } from "@/components/ui/data-list";
import { StatusBadge } from "@/components/ui/status-badge";
import { LinkButton } from "@/components/ui/button";
import { EDITORIAL_STATUS_TONES, PARTNERSHIP_STATUS_TONES } from "@/components/portal/tones";

export const metadata: Metadata = { title: "Mon lieu" };

function editorialExplanation(status: EditorialStatus, owner: string): string {
  switch (status) {
    case "DRAFT":
      return `La page de votre lieu est en cours de rédaction avec ${owner} ; elle n’est pas visible sur le site.`;
    case "REVIEW":
      return `${owner} relit la page de votre lieu avant de la publier.`;
    case "PUBLISHED":
      return "La page de votre lieu est visible publiquement sur le site.";
  }
}

export default async function PartnerHomePage() {
  const { user } = await requirePartner("/espace-partenaire");
  const [{ venue, stats, referralUrl }, settings] = await Promise.all([getPartnerPortal(user.id), getSettings()]);
  const owner = settings.ownerFirstName;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={venue.name}
        description={`${VENUE_TYPE_LABELS[venue.type]} · ${venue.postalCode ? `${venue.postalCode} ` : ""}${venue.city}`}
        meta={
          <>
            <StatusBadge tone={PARTNERSHIP_STATUS_TONES[venue.partnershipStatus]}>{PARTNERSHIP_STATUS_LABELS[venue.partnershipStatus]}</StatusBadge>
            <StatusBadge tone={EDITORIAL_STATUS_TONES[venue.editorialStatus]}>Page {EDITORIAL_STATUS_LABELS[venue.editorialStatus].toLowerCase()}</StatusBadge>
          </>
        }
      />

      <section aria-labelledby="page-title" className="flex flex-col gap-4">
        <h2 id="page-title" className="font-sans text-lg font-semibold text-ink-900">
          Votre page sur le site
        </h2>
        <LabelCard>
          <p className="text-[15px] leading-snug text-ink-900">{editorialExplanation(venue.editorialStatus, owner)}</p>
          {venue.editorialStatus === "PUBLISHED" ? (
            <p className="mt-3 text-[15px]">
              <Link href={`/lieux/${venue.slug}`} className="font-semibold text-sage-800 underline">
                Voir la page publique de {venue.name}
              </Link>
            </p>
          ) : null}
          <p className="mt-4 text-sm leading-snug text-ink-500">
            Dernière vérification des informations : {venue.lastVerifiedAt ? formatInstantParis(venue.lastVerifiedAt) : "pas encore effectuée"}. Pour toute correction, adressez-vous à {owner}.
          </p>
        </LabelCard>
      </section>

      <section aria-labelledby="referral-title" className="flex flex-col gap-4">
        <h2 id="referral-title" className="font-sans text-lg font-semibold text-ink-900">
          Votre lien d’apport
        </h2>
        <p className="max-w-2xl text-[15px] leading-snug text-ink-500">
          Les organisateurs qui passent par ce lien ou ce QR code sont rattachés à votre lieu. Le lien ne contient aucune donnée personnelle.
        </p>
        <LabelCard>
          <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- PNG generated per request by a route handler; no optimisation pipeline wanted. */}
            <img src="/espace-partenaire/qr" alt={`QR code menant à votre lien d’apport ${referralUrl}`} width={192} height={192} className="size-48 rounded-sm border border-sage-200 bg-ivory-50" />
            <div className="flex min-w-0 flex-col gap-3">
              <div>
                <p className="text-[13px] font-semibold tracking-[0.01em] text-ink-500">Adresse à partager</p>
                <p className="mt-1 rounded-sm border border-sage-200 bg-ivory-100 px-3 py-2 text-[15px] font-medium break-all text-ink-900 select-all tabular">{referralUrl}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href="/espace-partenaire/qr" download={`qr-${venue.slug}.png`} className="inline-flex h-9 items-center rounded-sm border border-sage-400 px-3 text-sm font-semibold text-sage-800 hover:bg-sage-50">
                  Télécharger le QR code (PNG)
                </a>
                <LinkButton href="/espace-partenaire/kit" variant="ghost" size="sm">
                  Kit de présentation imprimable
                </LinkButton>
              </div>
            </div>
          </div>
        </LabelCard>
      </section>

      <section aria-labelledby="stats-title" className="flex flex-col gap-4">
        <h2 id="stats-title" className="font-sans text-lg font-semibold text-ink-900">
          Demandes apportées
        </h2>
        <LabelCard>
          <DataList
            columns={2}
            items={[
              { label: "Demandes apportées", value: <span className="text-2xl font-semibold tabular">{stats.requests}</span> },
              { label: "Prestations confirmées", value: <span className="text-2xl font-semibold tabular">{stats.confirmedEvents}</span> },
            ]}
          />
          <p className="mt-4 text-sm leading-snug text-ink-500">Pour protéger les familles, aucune information nominative sur les demandes n’est accessible ici.</p>
        </LabelCard>
      </section>

      <section aria-labelledby="partnership-title" className="flex flex-col gap-4">
        <h2 id="partnership-title" className="font-sans text-lg font-semibold text-ink-900">
          Partenariat
        </h2>
        <LabelCard>
          <DataList
            columns={2}
            items={[
              { label: "Statut", value: PARTNERSHIP_STATUS_LABELS[venue.partnershipStatus] },
              { label: "Interlocutrice", value: `${owner} · ${settings.contactEmail}${settings.contactPhone ? ` · ${settings.contactPhone}` : ""}` },
            ]}
          />
        </LabelCard>
      </section>
    </div>
  );
}
