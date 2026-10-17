import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ImportWizard } from "@/components/calendar/import-wizard";
import { requireActor } from "@/lib/session";
import { listOwnProfessionals } from "@/modules/calendar/application/calendar-service";
import { importIcsAction, previewIcsAction } from "../actions";

export const metadata = { title: "Importer un calendrier — Sous Nos Ailes" };

export default async function ImportPage() {
  const actor = await requireActor("/app/calendrier/import");
  const professionals = await listOwnProfessionals(actor);
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/app/calendrier">
          <ArrowLeft className="size-4" aria-hidden="true" /> Calendrier
        </Link>
      </Button>
      <PageHeader eyebrow="Agenda" title="Importer un fichier ICS" description="Validation stricte : seuls les évènements complets et compris sont importés ; les autres sont listés comme ignorés." />
      <ImportWizard professionals={professionals} onPreview={previewIcsAction} onImport={importIcsAction} />
    </div>
  );
}
