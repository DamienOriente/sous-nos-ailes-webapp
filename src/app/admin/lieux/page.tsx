import type { Metadata } from "next";
import Link from "next/link";
import { listVenuesForAdmin } from "@/server/services/venues";
import { VENUE_TYPE_LABELS } from "@/domain/labels";
import { formatInstantParis } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EditorialBadge, PartnershipBadge } from "@/components/admin/badges";

export const metadata: Metadata = { title: "Lieux partenaires" };

export default async function VenuesPage() {
  const venues = await listVenuesForAdmin();
  return (
    <>
      <PageHeader
        title="Lieux partenaires"
        description="Pages publiques des lieux, liens d’orientation et mémoire opérationnelle. Une page n’est visible qu’une fois publiée."
        actions={<LinkButton href="/admin/lieux/nouveau">Ajouter un lieu</LinkButton>}
      />
      {venues.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Lieu</Th>
              <Th>Page</Th>
              <Th>Partenariat</Th>
              <Th className="text-right">Orientations</Th>
              <Th className="text-right">Événements</Th>
              <Th>Vérifié le</Th>
            </tr>
          </thead>
          <tbody>
            {venues.map((venue) => (
              <tr key={venue.id}>
                <Td className="min-w-52">
                  <Link href={`/admin/lieux/${venue.id}`} className="font-semibold text-sage-800 hover:underline">
                    {venue.name}
                  </Link>
                  <span className="block text-[13px] text-ink-500">
                    {VENUE_TYPE_LABELS[venue.type]} · {venue.city}
                    {venue.partnerUser ? ` · compte : ${venue.partnerUser.email}` : ""}
                  </span>
                  {venue.isDemo ? (
                    <StatusBadge tone="clay" className="mt-1">
                      Lieu fictif (démonstration)
                    </StatusBadge>
                  ) : null}
                </Td>
                <Td>
                  <EditorialBadge status={venue.editorialStatus} />
                </Td>
                <Td>
                  <PartnershipBadge status={venue.partnershipStatus} />
                </Td>
                <Td className="text-right tabular">{venue._count.referrals}</Td>
                <Td className="text-right tabular">{venue._count.events}</Td>
                <Td className="whitespace-nowrap text-ink-700">{venue.lastVerifiedAt ? formatInstantParis(venue.lastVerifiedAt) : <span className="text-ink-500">Jamais</span>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="Aucun lieu partenaire" description="Ajoutez un lieu pour préparer sa page, son lien d’orientation et son kit imprimable." action={<LinkButton href="/admin/lieux/nouveau" variant="secondary">Ajouter un lieu</LinkButton>} />
      )}
    </>
  );
}
