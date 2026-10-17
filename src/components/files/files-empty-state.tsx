import { FileText, ImageIcon, ShieldCheck } from "lucide-react";
import { CameraScene } from "@/components/illustrations";

/** Empty "Mes fichiers": what will be listed, and the pipeline every file goes through. */
export function FilesEmptyState() {
  return (
    <div className="grid gap-6 rounded-2xl border border-dashed bg-card/60 p-6 sm:grid-cols-[12rem_1fr] sm:items-center" role="status">
      <CameraScene className="mx-auto w-40 sm:w-full" />
      <div className="space-y-3">
        <h3 className="font-heading text-xl font-semibold">Aucun fichier pour l'instant</h3>
        <p className="text-sm text-muted-foreground text-pretty">Les fichiers que vous envoyez apparaissent ici une fois vérifiés : par exemple votre photo de profil, ou le devis signé d'un prestataire que vous voulez garder sous la main.</p>
        <ul className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <li className="flex items-start gap-2 rounded-lg bg-muted/50 p-2"><ImageIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" /> Images converties en WebP, métadonnées GPS supprimées</li>
          <li className="flex items-start gap-2 rounded-lg bg-muted/50 p-2"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" /> Analyse antivirus avant toute mise à disposition</li>
          <li className="flex items-start gap-2 rounded-lg bg-muted/50 p-2"><FileText className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" /> Téléchargement par lien signé, valable quelques minutes</li>
        </ul>
      </div>
    </div>
  );
}
