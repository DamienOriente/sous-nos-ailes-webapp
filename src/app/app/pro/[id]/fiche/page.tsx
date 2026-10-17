import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { db } from "@/db/client";
import { organizations } from "@/db/schema";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { ActionForm } from "@/components/professionals/action-form";
import { CategoryPicker } from "@/components/professionals/category-picker";
import { IdentityFields, PresentationFields } from "@/components/professionals/listing-fields";
import { TradeFormFields } from "@/components/professionals/trade-form-fields";
import { requireActor } from "@/lib/session";
import { getManagedListing, listActiveCategories } from "@/modules/professionals/application/professional-service";
import { CATEGORY_GROUPS } from "@/modules/professionals/domain/categories";
import { archiveListingAction, updateListingAction } from "./actions";

export const metadata: Metadata = { title: "Ma fiche" };

export default async function ListingEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const actor = await requireActor(`/app/pro/${id}/fiche`);
  const { listing, category, secondaryCategories } = await getManagedListing(actor, id);
  const categories = await listActiveCategories();
  // A different category can be previewed through ?category= so the trade form matches before saving.
  const previewCategory = (sp.category && categories.find((c) => c.id === sp.category)) || category;
  const org = listing.organizationId ? (await db.select().from(organizations).where(eq(organizations.id, listing.organizationId)).limit(1))[0] : undefined;
  return (
    <div className="space-y-8">
      <PageHeader title="Ma fiche" description="Toutes les informations de votre fiche. Les modifications sont enregistrées immédiatement ; sur une fiche publiée, un changement de nom, de métier ou de description est relu par notre équipe (la fiche reste en ligne)." />
      {listing.status === "published" && (
        <Alert>
          <AlertTitle>Fiche publiée</AlertTitle>
          <AlertDescription>Nom, métier principal, accroche et description sont des champs majeurs : les modifier ouvre une relecture. Les autres champs sont mis à jour directement.</AlertDescription>
        </Alert>
      )}
      <ActionForm action={updateListingAction} submitLabel="Enregistrer la fiche" successMessage="Fiche enregistrée." className="space-y-10">
        <input type="hidden" name="id" value={listing.id} />
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold">Métier</h2>
          <CategoryPicker
            categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, group: c.group, description: c.description, isChildcare: c.isChildcare, icon: c.icon }))}
            groups={[...CATEGORY_GROUPS]}
            primaryId={previewCategory.id}
            secondaryIds={secondaryCategories.map((c) => c.id)}
            syncQuery
          />
        </section>
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold">Identité commerciale et localisation</h2>
          <IdentityFields listing={listing} organizationType={org?.type ?? null} siret={org?.siret ?? org?.siren ?? null} />
        </section>
        <section>
          <TradeFormFields formSchemaKey={previewCategory.formSchemaKey} values={previewCategory.id === category.id ? listing.tradeDetails : {}} />
        </section>
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-semibold">Présentation, tarifs et contacts</h2>
          <PresentationFields listing={listing} />
        </section>
      </ActionForm>
      {listing.status !== "archived" && (
        <section className="rounded-2xl border border-destructive/30 p-5">
          <h2 className="font-semibold">Archiver la fiche</h2>
          <p className="mt-1 text-sm text-muted-foreground">La fiche disparaît de l'annuaire et de votre espace. Les demandes et l'historique sont conservés pour vos obligations légales.</p>
          <div className="mt-4">
            <ConfirmDialog
              trigger={
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-4" aria-hidden="true" />
                  Archiver
                </Button>
              }
              title="Archiver cette fiche ?"
              description="Cette action retire la fiche de l'annuaire. Vous pourrez créer une nouvelle fiche plus tard."
              confirmLabel="Archiver"
              onConfirm={archiveListingAction.bind(null, listing.id)}
            />
          </div>
        </section>
      )}
    </div>
  );
}
