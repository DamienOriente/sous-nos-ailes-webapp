import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { requireActor } from "@/lib/session";
import { listChildren } from "@/modules/childcare/application/children-service";
import { guardPage } from "@/components/childcare/page-guard";

export const metadata = { title: "Procédure d'urgence" };

/**
 * Emergency procedure: national numbers, who to call, what to say, and the
 * guardian phones of the children in the actor's scope. No health data here:
 * it is read on the child's page, with a purpose, when needed.
 */
export default async function EmergencyProcedurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const actor = await requireActor(`/app/evenements/${eventId}/enfants/procedure`);
  const { children } = await guardPage(() => listChildren(actor, eventId));
  return (
    <div className="space-y-6">
      <Link href={`/app/evenements/${eventId}/enfants`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" /> Enfants</Link>
      <PageHeader title="Procédure d'urgence" description="À lire avant l'évènement et à garder sous la main le jour J." />
      <Alert className="border-destructive/40 bg-destructive/5">
        <AlertTitle>Urgence vitale : appelez d'abord les secours</AlertTitle>
        <AlertDescription>
          <div className="flex flex-wrap gap-3 pt-1">
            <a href="tel:15" className="rounded-full bg-destructive px-4 py-1.5 font-semibold text-white">
              15 : SAMU
            </a>
            <a href="tel:112" className="rounded-full bg-destructive px-4 py-1.5 font-semibold text-white">
              112 : urgences (UE)
            </a>
            <a href="tel:18" className="rounded-full border px-4 py-1.5 font-semibold">
              18 : pompiers
            </a>
            <a href="tel:114" className="rounded-full border px-4 py-1.5 font-semibold">
              114 : SMS pour sourds et malentendants
            </a>
          </div>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-3 p-6">
          <h2 className="font-semibold">Conduite à tenir</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Mettre l'enfant en sécurité et ne jamais le laisser seul ; un membre de l'équipe reste avec les autres enfants.</li>
            <li>Appeler le 15 / 112 si nécessaire : donner le lieu exact, l'âge de l'enfant, ce qui s'est passé, l'état actuel.</li>
            <li>Consulter les informations de santé de l'enfant sur sa fiche (motif : « urgence ») si une allergie ou un traitement est signalé.</li>
            <li>Prévenir le responsable légal (téléphone sur la fiche), puis les contacts d'urgence dans l'ordre de priorité.</li>
            <li>Prévenir l'organisateur de l'évènement.</li>
            <li>Consigner l'incident sur la fiche de l'enfant (faits, heure, personnes présentes) dès que possible.</li>
          </ol>
          <h3 className="pt-2 font-semibold">Règles de remise</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Un enfant n'est remis qu'à une personne autorisée enregistrée par l'organisateur.</li>
            <li>L'identité est vérifiée (pièce d'identité, personne connue, confirmation téléphonique du responsable) et la remise confirmée par un membre connecté.</li>
            <li>Aucun QR code ni message ne remplace cette vérification.</li>
          </ul>
        </Card>
        <Card className="gap-3 p-6">
          <h2 className="font-semibold">Responsables légaux à joindre</h2>
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun enfant dans votre périmètre.</p>
          ) : (
            <ul className="divide-y text-sm">
              {children.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <Link href={`/app/evenements/${eventId}/enfants/${c.id}`} className="font-medium hover:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{c.guardianName}</div>
                  </div>
                  <a href={`tel:${c.guardianPhone}`} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted">
                     {c.guardianPhone}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
