import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CsvImportWizard } from "@/components/contacts/csv-import-wizard";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { importGuestsAction } from "../actions";

export const metadata = { title: "Importer des invités" };

export default async function GuestImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/invites/import`);
  try {
    await requireEventPermission(actor, id, "event.guests.manage");
  } catch (e) {
    if (isAppError(e)) notFound();
    throw e;
  }
  const onImport = importGuestsAction.bind(null, id);
  return (
    <div className="space-y-6">
      <Link href={`/app/evenements/${id}/invites`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" /> Invités</Link>
      <PageHeader title="Importer des invités (CSV)" description="Colonnes reconnues : prénom, nom, e-mail, téléphone, groupe, enfant (oui/non), âge, régime, accompagnants, notes. Les groupes inconnus sont créés automatiquement." />
      <CsvImportWizard kind="guests" onImport={onImport} doneHref={`/app/evenements/${id}/invites`} />
    </div>
  );
}
