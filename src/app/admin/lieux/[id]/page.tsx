import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVenueForAdmin, getVenueStats, referralUrlFor, VENUE_ILLUSTRATIONS } from "@/server/services/venues";
import { listAuditForEntity } from "@/server/services/audit";
import { linkPartnerUserAction, markVenueVerifiedAction, setEditorialStatusAction } from "@/server/actions/admin/venues";
import { VENUE_TYPE_LABELS } from "@/domain/labels";
import { formatDateOnlyLong, formatInstantParis } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { LabelCard } from "@/components/ui/label-card";
import { DataList } from "@/components/ui/data-list";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Table, Td, Th } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Flash } from "@/components/admin/flash";
import { AdminSection, Disclosure, HelpText } from "@/components/admin/section";
import { EditorialBadge, EventStatusBadge, PartnershipBadge } from "@/components/admin/badges";
import { VenueForm } from "@/components/admin/venue-form";
import { NotesSection } from "@/components/admin/notes-section";
import { AuditSection } from "@/components/admin/audit-list";

export const metadata: Metadata = { title: "Lieu partenaire" };

const REFERRAL_SOURCE_LABELS = { LINK: "Lien", QR: "QR code", VENUE_PAGE: "Page du lieu" } as const;

export default async function VenuePage({ params, searchParams }: PageProps<"/admin/lieux/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [venue, stats, audit] = await Promise.all([getVenueForAdmin(id), getVenueStats(id), listAuditForEntity("PartnerVenue", id)]);
  if (!venue) notFound();
  const path = `/admin/lieux/${id}`;
  const referralUrl = referralUrlFor(venue.referralCode);
  const published = venue.editorialStatus === "PUBLISHED";

  return (
    <>
      <PageHeader
        title={venue.name}
        description={`${VENUE_TYPE_LABELS[venue.type]} · ${venue.postalCode ? `${venue.postalCode} ` : ""}${venue.city}${venue.region ? ` · ${venue.region}` : ""}`}
        meta={
          <>
            <EditorialBadge status={venue.editorialStatus} />
            <PartnershipBadge status={venue.partnershipStatus} />
            {venue.isDemo ? <StatusBadge tone="clay">Lieu fictif (démonstration)</StatusBadge> : null}
          </>
        }
        actions={
          <>
            {published ? (
              <LinkButton href={`/lieux/${venue.slug}`} variant="secondary" size="sm">
                Voir la page publique
              </LinkButton>
            ) : null}
            <LinkButton href={`${path}/kit`} variant="secondary" size="sm">
              Kit imprimable
            </LinkButton>
            <LinkButton href="/admin/lieux" variant="ghost" size="sm">
              Tous les lieux
            </LinkButton>
          </>
        }
      />

      <Flash searchParams={query} />

      <div className="grid gap-6 lg:grid-cols-2">
        <LabelCard title="Publication">
          <p className="mt-1 text-sm text-ink-500">Brouillon → à valider → publiée. La publication exige un texte original suffisant.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {venue.editorialStatus === "DRAFT" ? (
              <form action={setEditorialStatusAction.bind(null, id, "REVIEW")}>
                <Button type="submit" variant="secondary" size="sm">
                  Envoyer en validation
                </Button>
              </form>
            ) : null}
            {venue.editorialStatus === "REVIEW" ? (
              <>
                <form action={setEditorialStatusAction.bind(null, id, "PUBLISHED")}>
                  <Button type="submit" variant="sage" size="sm">
                    Publier la page
                  </Button>
                </form>
                <form action={setEditorialStatusAction.bind(null, id, "DRAFT")}>
                  <Button type="submit" variant="ghost" size="sm">
                    Repasser en brouillon
                  </Button>
                </form>
              </>
            ) : null}
            {venue.editorialStatus === "PUBLISHED" ? (
              <form action={setEditorialStatusAction.bind(null, id, "DRAFT")}>
                <Button type="submit" variant="danger" size="sm">
                  Dépublier (repasser en brouillon)
                </Button>
              </form>
            ) : null}
          </div>
          <DataList
            className="mt-5"
            items={[
              { label: "Publiée le", value: venue.publishedAt ? formatInstantParis(venue.publishedAt) : "Jamais" },
              { label: "Informations vérifiées le", value: venue.lastVerifiedAt ? formatInstantParis(venue.lastVerifiedAt) : "Jamais" },
            ]}
          />
          <form action={markVenueVerifiedAction.bind(null, id)} className="mt-4">
            <Button type="submit" variant="secondary" size="sm">
              Marquer vérifié aujourd’hui
            </Button>
          </form>
        </LabelCard>

        <LabelCard title="Lien d’orientation">
          <p className="mt-1 text-sm text-ink-500">À transmettre au lieu : chaque demande arrivée par ce lien lui est attribuée. Le code n’est pas un secret.</p>
          <Field label="Adresse à copier" htmlFor="referral-url" className="mt-4">
            <Input id="referral-url" value={referralUrl} readOnly className="tabular" />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`${path}/qr`} download={`qr-${venue.slug}.png`} className="inline-flex h-9 cursor-pointer items-center rounded-sm border border-sage-400 px-3 text-sm font-semibold text-sage-800 hover:bg-sage-50">
              Télécharger le QR code (PNG)
            </a>
            <LinkButton href={`${path}/kit`} variant="ghost" size="sm">
              Ouvrir le kit imprimable
            </LinkButton>
          </div>
          <DataList
            className="mt-5"
            columns={2}
            items={[
              { label: "Demandes orientées", value: <span className="tabular">{stats.requests}</span> },
              { label: "Événements confirmés ou réalisés", value: <span className="tabular">{stats.confirmedEvents}</span> },
            ]}
          />
          <HelpText className="mt-3">Chiffres agrégés uniquement : c’est aussi tout ce que voit le partenaire dans son espace.</HelpText>
        </LabelCard>
      </div>

      <AdminSection id="fiche" title="Fiche du lieu">
        <VenueForm
          mode="edit"
          venueId={id}
          illustrations={VENUE_ILLUSTRATIONS}
          values={{
            name: venue.name,
            slug: venue.slug,
            type: venue.type,
            city: venue.city,
            postalCode: venue.postalCode,
            region: venue.region,
            officialWebsite: venue.officialWebsite,
            summary: venue.summary,
            description: venue.description,
            childrenSpaces: venue.childrenSpaces,
            constraints: venue.constraints,
            accessInfo: venue.accessInfo,
            contactName: venue.contactName,
            contactEmail: venue.contactEmail,
            contactPhone: venue.contactPhone,
            partnershipStatus: venue.partnershipStatus,
            illustrationKey: venue.illustrationKey,
          }}
        />
      </AdminSection>

      <AdminSection id="compte" title="Compte partenaire" description="Un compte « partenaire » voit uniquement sa page, son lien, son QR code et des chiffres agrégés.">
        {venue.partnerUser ? (
          <DataList columns={2} items={[{ label: "Nom", value: venue.partnerUser.name }, { label: "Email de connexion", value: venue.partnerUser.email }]} />
        ) : (
          <HelpText>Aucun compte rattaché pour l’instant.</HelpText>
        )}
        <Disclosure summary={venue.partnerUser ? "Rattacher un autre compte" : "Rattacher un compte partenaire"}>
          <form action={linkPartnerUserAction.bind(null, id)} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Email" htmlFor="partner-email" required>
              <Input id="partner-email" name="email" type="email" inputMode="email" required />
            </Field>
            <Field label="Nom" htmlFor="partner-name" required>
              <Input id="partner-name" name="name" maxLength={120} required />
            </Field>
            <Button type="submit" variant="secondary" className="h-11">
              Rattacher
            </Button>
          </form>
          <HelpText className="mt-3">Aucun email n’est envoyé : la personne demande son lien de connexion depuis la page de connexion.</HelpText>
        </Disclosure>
      </AdminSection>

      <NotesSection id="memoire" title="Mémoire du lieu" description="Retours opérationnels des missions passées : accès, stationnement, espaces, interlocuteurs. Reprise dans chaque fiche d’événement qui s’y déroule." notes={venue.notes} target={{ venueId: id }} returnPath={path} emptyLabel="Aucune mémoire pour ce lieu." />

      <div className="grid gap-8 lg:grid-cols-2">
        <AdminSection id="orientations" title="Dernières orientations" description="Demandes arrivées par le lien, le QR code ou la page du lieu.">
          {venue.referrals.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Canal</Th>
                  <Th>Dossier</Th>
                </tr>
              </thead>
              <tbody>
                {venue.referrals.map((referral) => (
                  <tr key={referral.id}>
                    <Td className="whitespace-nowrap text-ink-700">{formatInstantParis(referral.createdAt)}</Td>
                    <Td>{REFERRAL_SOURCE_LABELS[referral.sourceKind]}</Td>
                    <Td>
                      {referral.request.event ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/admin/evenements/${referral.request.event.id}`} className="font-semibold text-sage-800 tabular hover:underline">
                            {referral.request.event.reference}
                          </Link>
                          <EventStatusBadge status={referral.request.event.status} />
                        </div>
                      ) : (
                        <span className="text-ink-500">Demande sans dossier</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <HelpText>Aucune orientation enregistrée.</HelpText>
          )}
        </AdminSection>

        <AdminSection id="evenements" title="Événements sur ce lieu">
          {venue.events.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Référence</Th>
                  <Th>Date</Th>
                  <Th>Statut</Th>
                </tr>
              </thead>
              <tbody>
                {venue.events.map((event) => (
                  <tr key={event.id}>
                    <Td className="min-w-40">
                      <Link href={`/admin/evenements/${event.id}`} className="font-semibold text-sage-800 tabular hover:underline">
                        {event.reference}
                      </Link>
                      <span className="block text-[13px] text-ink-500">{event.title}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-700">{formatDateOnlyLong(event.date)}</Td>
                    <Td>
                      <EventStatusBadge status={event.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <HelpText>Aucun événement rattaché à ce lieu.</HelpText>
          )}
        </AdminSection>
      </div>

      <AuditSection entries={audit} />
    </>
  );
}
