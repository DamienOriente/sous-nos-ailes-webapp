import { CameraScene } from "@/components/illustrations";

/** Empty "Mes fichiers": what will be listed, and the pipeline every file goes through. */
export function FilesEmptyState() {
  return (
    <div className="grid gap-6 rounded-2xl border border-dashed bg-card p-6 sm:grid-cols-[12rem_1fr] sm:items-center" role="status">
      <CameraScene className="mx-auto w-40 sm:w-full" />
      <div className="space-y-3">
        <h3 className="font-heading text-xl font-semibold">Aucun fichier pour l'instant</h3>
        <p className="text-sm text-muted-foreground text-pretty">Les fichiers que vous envoyez apparaissent ici une fois vérifiés : par exemple votre photo de profil, ou le devis signé d'un prestataire que vous voulez garder sous la main.</p>
        <ul className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <li className="rounded-lg bg-muted/50 p-2">Images converties en WebP, métadonnées GPS supprimées</li>
          <li className="rounded-lg bg-muted/50 p-2">Analyse antivirus avant toute mise à disposition</li>
          <li className="rounded-lg bg-muted/50 p-2">Téléchargement par lien signé, valable quelques minutes</li>
        </ul>
      </div>
    </div>
  );
}
