import type { Metadata } from "next";
import { VENUE_ILLUSTRATIONS } from "@/server/services/venues";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { VenueForm } from "@/components/admin/venue-form";

export const metadata: Metadata = { title: "Nouveau lieu partenaire" };

export default function NewVenuePage() {
  return (
    <>
      <PageHeader
        title="Nouveau lieu partenaire"
        description="La fiche démarre en brouillon : rien n’est publié avant votre validation. Le lien d’orientation et le QR code sont créés automatiquement."
        actions={
          <LinkButton href="/admin/lieux" variant="ghost" size="sm">
            Retour à la liste
          </LinkButton>
        }
      />
      <VenueForm mode="create" illustrations={VENUE_ILLUSTRATIONS} />
    </>
  );
}
