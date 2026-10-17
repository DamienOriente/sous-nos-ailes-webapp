import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { CsvImportWizard } from "@/components/contacts/csv-import-wizard";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { importGuestsAction } from "../actions";

export const metadata = { title: "Importer des invités — Sous Nos Ailes" };

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
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/app/evenements/${id}/invites`}>
          <ArrowLeft className="size-4" aria-hidden="true" /> Invités
        </Link>
      </Button>
      <PageHeader eyebrow="Évènement" title="Importer des invités (CSV)" description="Colonnes reconnues : prénom, nom, e-mail, téléphone, groupe, enfant (oui/non), âge, régime, accompagnants, notes. Les groupes inconnus sont créés automatiquement." />
      <CsvImportWizard kind="guests" onImport={onImport} doneHref={`/app/evenements/${id}/invites`} />
    </div>
  );
}
