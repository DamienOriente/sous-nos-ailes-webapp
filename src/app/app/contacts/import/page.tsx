import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CsvImportWizard } from "@/components/contacts/csv-import-wizard";
import { requireActor } from "@/lib/session";
import { listOrganizationScopes } from "@/modules/contacts/application/contact-service";
import { importContactsAction } from "../actions";

export const metadata = { title: "Importer des contacts" };

export default async function ContactImportPage() {
  const actor = await requireActor("/app/contacts/import");
  const orgs = await listOrganizationScopes(actor);
  const scopes = [{ value: "personal", label: "Mon carnet personnel" }, ...orgs.filter((o) => o.canWrite).map((o) => ({ value: o.id, label: o.name }))];
  return (
    <div className="space-y-6">
      <Link href="/app/contacts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" /> Contacts</Link>
      <PageHeader title="Importer un fichier CSV" description="Colonnes reconnues : prénom, nom (ou nom complet), société, e-mail, téléphone, catégorie, tags, notes. Un aperçu s'affiche avant tout enregistrement." />
      <CsvImportWizard kind="contacts" scopes={scopes} onImport={importContactsAction} doneHref="/app/contacts" />
    </div>
  );
}
