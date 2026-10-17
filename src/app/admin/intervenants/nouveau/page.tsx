import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ProviderForm } from "@/components/admin/provider-form";

export const metadata: Metadata = { title: "Nouveau profil intervenant·e" };

export default function NewProviderPage() {
  return (
    <>
      <PageHeader
        title="Nouveau profil"
        description="Créez le compte et le profil d’une personne de votre réseau. Vous vérifiez ensuite ses qualifications depuis sa fiche."
        actions={
          <LinkButton href="/admin/intervenants" variant="ghost" size="sm">
            Retour à la liste
          </LinkButton>
        }
      />
      <Alert kind="info" role="status">
        À la création, un lien de connexion est envoyé par email à la personne : aucun mot de passe à transmettre. Le profil démarre en « Nouveau profil », sans vérification.
      </Alert>
      <ProviderForm mode="create" />
    </>
  );
}
