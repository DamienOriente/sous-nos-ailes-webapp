import { Download } from "lucide-react";
import { AddDocumentDialog, DeleteDocumentButton } from "@/components/events/document-forms";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { DocumentsScene } from "@/components/illustrations/event-scenes";
import { PageHeader, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { requireActor } from "@/lib/session";
import { formatDateFr } from "@/lib/utils";
import { listDocuments } from "@/modules/events/application/document-service";
import { DOCUMENT_KIND_LABELS } from "@/modules/events/domain/document-labels";
import { listProviders } from "@/modules/events/application/provider-service";
import { privateFileHref } from "@/modules/files/application/file-urls";
import { guardPage } from "../_guards";
import { addDocumentAction, deleteDocumentAction } from "./actions";

function formatSize(bytes: number | null) {
  if (bytes === null) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/documents`);
  const { documents, access } = await guardPage(() => listDocuments(actor, id));
  const canManage = access.permissions.has("event.documents.manage");
  const providers = canManage ? (await listProviders(actor, id)).providers.filter((p) => !p.displayName.startsWith("À trouver")).map((p) => ({ id: p.id, label: p.displayName })) : [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description={canManage ? "Contrats, devis, briefs et plans. Choisissez qui peut voir chaque document." : "Les documents que l'organisateur partage avec vous."}
        actions={canManage && documents.length > 0 ? <AddDocumentDialog eventId={id} providers={providers} action={addDocumentAction} /> : undefined}
      />
      {documents.length === 0 ? (
        <IllustratedEmpty
          scene={DocumentsScene}
          title="Aucun document"
          description={canManage ? "Contrats, devis, briefs, plans de salle : chaque fichier est analysé (antivirus) avant d'être téléchargeable, et vous choisissez qui le voit : les organisateurs, toute l'équipe ou un prestataire précis." : "Rien n'a encore été partagé avec vous. Les documents que l'organisateur vous destine apparaîtront ici."}
          example="Contrat traiteur de Julien Rossi (PDF, visible des organisateurs)"
          action={canManage ? <AddDocumentDialog eventId={id} providers={providers} action={addDocumentAction} /> : undefined}
          testId="documents-empty"
        />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {DOCUMENT_KIND_LABELS[d.kind as keyof typeof DOCUMENT_KIND_LABELS] ?? d.kind} · {d.fileName ?? "fichier"} {formatSize(d.sizeBytes)} · {d.uploadedByName ?? "auteur inconnu"} · {formatDateFr(d.createdAt, { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              {canManage && <StatusBadge tone={d.visibility === "organizers" ? "neutral" : d.visibility === "team" ? "primary" : "info"} dot={false}>{d.visibility === "organizers" ? "Organisateurs" : d.visibility === "team" ? "Équipe" : `Partagé : ${d.providerLabel ?? "prestataire"}`}</StatusBadge>}
              {d.fileStatus && d.fileStatus !== "clean" && <StatusBadge tone={d.fileStatus === "infected" || d.fileStatus === "rejected" ? "danger" : "warning"}>{d.fileStatus === "infected" ? "Bloqué" : d.fileStatus === "rejected" ? "Refusé" : "Analyse…"}</StatusBadge>}
              <Button asChild variant="ghost" size="icon-sm" aria-label={`Télécharger ${d.title}`} disabled={d.fileStatus !== "clean"}>
                <a href={privateFileHref(d.fileId, { download: true })}>
                  <Download className="size-4" aria-hidden="true" />
                </a>
              </Button>
              {canManage && <DeleteDocumentButton eventId={id} documentId={d.id} title={d.title} action={deleteDocumentAction} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
